const portals = require('./portals.json');
const express = require('express');
const request = require('request');
const xml2js = require('xml2js');
const Database = require('@replit/database')

const app = express();
const lastAlarmEndpoint = process.env['LAST_ALARM_ENDPOINT'];
const maxSavedAlarms = 50;
const parser = new xml2js.Parser({ explicitArray: false });
const db = new Database();

function getLastAlarm(portalID) {
	const url = `${lastAlarmEndpoint}?portalID=${portalID}`;
	return new Promise((resolve, reject) => {
		request(url, (error, response, body) => {
			parser.parseString(body, (e, result) => {
				resolve({agency: portals[portalID], ...formatAlarm(result)});
			});
		});
	});
}

function formatAlarm(alarmData) {
	const a = alarmData['Alarm'];
	
	let n = a['NarrativeLines']['Narrative'];
	if (n === undefined) n = [];
	if (!Array.isArray(n)) n = [n];
	const narrative = n.map(x => ({
		time: timestamp(x['TimeStamp']),
		text: x['NarrativeText']
	}));
	
	let u = a['Units']['Unit'];
	if (u === undefined) u = [];
	if (!Array.isArray(u)) u = [u];
	const units = u.map(x => ({
		id: x['UnitNumber'],
		dispatched: timestamp(x['Dispatched']),
		enroute: timestamp(x['Enroute']),
		onScene: timestamp(x['AtScene']),
		inService: timestamp(x['InService'])
	}));

	let d = a['AuxData']['AlarmAuxData'];
	if (d === undefined) d = [];
	if (!Array.isArray(d)) d = [d];
	const wantedAuxData = {
		'DispatchTime': 'Dispatch Time',
		'Zone': 'Response Area',
		'Problem': 'Problem',
		'xXStreet': 'Cross Sts',
		'IncidentNumber': 'Master Case',
		'AgencyIncidentNumber': 'Agency Case',
		'CallType': 'Call Type',
		'CallerName': 'Caller Name',
		'CallbackPhone': 'Callback Phone'
	};
	const auxData = d.filter(x => x['Name'] in wantedAuxData).map(x => ({
		name: wantedAuxData[x['Name']],
		value: x['Value']
	}));
	
	return {
		id: a['AlarmID'],
		time: new Date(a['StartTime']).getTime(),
		address: a['Address'],
		narrative: narrative,
		units: units,
		aux: auxData,
		latitude: a['Latitude'],
		longitude: a['Longitude'],
		summary: a['FilteredSummary']
	};
}

function timestamp(dateStr) {
	if (dateStr === '') return '';
	const [date, time] = dateStr.split(/\s+/);
	return time;
}

function updateAlarms() {
	const start = Date.now();
	Promise.all(Object.keys(portals).map(portalID => getLastAlarm(portalID)))
	.then(alarms => {
		const lastAlarms = Object.fromEntries(alarms.map(x => [x.id, x]));
		db.get('gists').then(value => {
			let gists = (value === null) ? [] : value;
			gists = gists.filter(g => !(g.id in lastAlarms));
			gists.push(...alarms.map(a => ({
				id: a.id,
				summary: a.summary,
				time: a.time,
				agency: a.agency
			})));
			gists.sort((a, b) => b.time - a.time);
			toSave = gists.slice(0, maxSavedAlarms);
			toRemove = gists.slice(maxSavedAlarms);
			Promise.all([
				...toRemove.map(a => db.delete(a.id)),
				...toSave.filter(a => a.id in lastAlarms)
						 .map(a => db.set(a.id, lastAlarms[a.id])),
				db.set('gists', toSave)
			]).then(() => {
				console.log(`updated in ${Date.now() - start}ms`);
			});
		});
	});
}

app.use(express.static('public'));

app.get('/list', (req, res) => {
	db.get('gists').then(gists => {
		res.json(gists === null ? [] : gists);
	});
});

app.get('/alarm', (req, res) => {
	const id = req.query.id;
	if (!id) return res.status(400).send('missing id');
	if (!/\d+/.test(id)) return res.status(400).send('invalid id');
	db.get(id).then(alarm => {
		(alarm === null ? res.status(404).send('alarm not found') : res.json(alarm));
	});
});

setInterval(updateAlarms, 60 * 1000);

app.listen(3000, () => {
  console.log('server started');
});