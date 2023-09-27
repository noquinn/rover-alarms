import express from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import config from './config.json' assert { type: 'json' };
import fetch from 'node-fetch';
import xml2js from 'xml2js';
import Database from '@replit/database';
import dotenv from 'dotenv';
dotenv.config();

const { LAST_ALARM_ENDPOINT, REPLIT_DB_URL } = process.env;
if (!LAST_ALARM_ENDPOINT)
	throw new Error('Missing environment var LAST_ALARM_ENDPOINT');
if (!REPLIT_DB_URL)
	throw new Error(
		'REPLIT_DB_URL must be set manually if not running in Replit'
	);

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database();
const app = express();
const parser = new xml2js.Parser({ explicitArray: false });
const { maxSavedAlarms, portals } = config;
const auxData = {
	Zone: 'Response Area',
	LocationName: 'Location',
	xXstreet: 'Cross Streets',
	PriorityDescription: 'Priority',
	Problem: 'Problem',
	CallType: 'Call Type',
	CallerName: 'Caller',
	MasterIncidentNumber: 'Master Case',
	AgencyIncidentNumber: 'Agency Case',
};

async function getLastAlarm(portalID) {
	try {
		const url = `${LAST_ALARM_ENDPOINT}?portalID=${portalID}`;
		const response = await fetch(url);
		const text = await response.text();
		const rawAlarmData = await parser.parseStringPromise(text);
		return {
			agency: portals[portalID],
			...formatAlarm(rawAlarmData),
		};
	} catch (e) {
		console.error(`Failed to get latest alarm from portal ${portalID}`);
		console.error(e);
	}
}

function formatAlarm(alarmData) {
	const a = alarmData['Alarm'];

	// format narrative
	let n = a['NarrativeLines']['Narrative'];
	if (n === undefined) n = [];
	if (!Array.isArray(n)) n = [n];
	const narrative = n.map((x) => ({
		id: x['ItemId'],
		time: timestamp(x['TimeStamp']),
		text: x['NarrativeText'],
	}));

	// format units
	let u = a['Units']['Unit'];
	if (u === undefined) u = [];
	if (!Array.isArray(u)) u = [u];
	const units = u.map((x) => ({
		id: x['UnitId'],
		name: x['UnitNumber'],
		dispatched: timestamp(x['Dispatched']),
		enroute: timestamp(x['Enroute']),
		onScene: timestamp(x['AtScene']),
		inService: timestamp(x['InService']),
	}));

	// format aux data
	let d = a['AuxData']['AlarmAuxData'];
	if (d === undefined) d = [];
	if (!Array.isArray(d)) d = [d];
	const aux = d
		.filter((x) => x['Name'] in auxData)
		.map((x) => ({
			id: x['ItemId'],
			name: auxData[x['Name']],
			value: x['Value'],
		}));

	return {
		id: a['AlarmID'],
		time: new Date(`${a['StartTime']}Z`).getTime(),
		address: a['Address'],
		narrative: narrative,
		units: units,
		aux: aux,
		latitude: a['Latitude'],
		longitude: a['Longitude'],
		summary: a['FilteredSummary'],
	};
}

function timestamp(dateStr) {
	if (dateStr === '') return '';
	const [date, time] = dateStr.split(/\s+/);
	return time;
}

async function updateAlarms() {
	try {
		const start = Date.now();
		const alarms = await Promise.all(
			Object.keys(portals).map((portalID) => getLastAlarm(portalID))
		);
		const lastAlarms = Object.fromEntries(alarms.map((x) => [x.id, x]));
		let gists = await db.get('gists');
		if (gists === null) gists = [];
		gists = gists.filter((g) => !(g.id in lastAlarms));
		gists.push(
			...alarms.map((a) => ({
				id: a.id,
				summary: a.summary,
				time: a.time,
				agency: a.agency,
			}))
		);
		gists.sort((a, b) => b.time - a.time);
		const toSave = gists.slice(0, maxSavedAlarms);
		const toRemove = gists.slice(maxSavedAlarms);
		await Promise.all([
			...toRemove.map((a) => db.delete(a.id)),
			...toSave
				.filter((a) => a.id in lastAlarms)
				.map((a) => db.set(a.id, lastAlarms[a.id])),
			db.set('gists', toSave),
		]);
		console.log(`Updated alarms in ${Date.now() - start} ms`);
	} catch (e) {
		console.error('Failed to update alarms');
		console.error(e);
	}
}

app.get('/gists', async (req, res) => {
	try {
		const gists = await db.get('gists');
		res.json(gists === null ? [] : gists);
	} catch (e) {
		res.status(500).end();
	}
});

app.get('/alarm', async (req, res) => {
	try {
		const { id } = req.query;
		if (!id) res.status(400).send('Missing id');
		if (!/\d+/.test(id)) res.status(400).send('Invalid id');
		const alarm = await db.get(id);
		if (alarm === null) res.status(404).send('Alarm not found');
		res.json(alarm);
	} catch (e) {
		res.status(500).end();
	}
});

updateAlarms();
setInterval(updateAlarms, 60 * 1000);

if (process.env.NODE_ENV === 'production') {
	console.log('Starting production app...');

	app.use(express.static(path.join(__dirname, '..', 'dist')));
	app.use(express.static(path.join(__dirname, '..', 'public')));

	app.get('*', (req, res) => {
		res.status(404).end();
	});

	const port = process.env.PORT || 5000;
	app.listen(port, () => {
		console.log(`Server running on port ${port}`);
	});
}

export default app;
