let alarmList;
let alarms = [];

// prevent iOS Safari scrolling issues
window.addEventListener("scroll", (e) => {
	e.preventDefault();
	window.scrollTo(0, 0);
});

function $(selector) {
	return document.querySelector(selector);
}

function get(url) {
	return new Promise((resolve, reject) => {
		fetch(url)
		.then((response) => response.json())
		.then((data) => resolve(data))
		.catch((error) => console.error(error.message));
	});
}

function updateAlarms() {
	get('/list')
	.then((alarmData) => {
		alarmData = alarmData.sort((a, b) => {
			if (a.time == b.time) return b.id - a.id;
			return b.time - a.time;
		});
		if (JSON.stringify(alarms) == JSON.stringify(alarmData)) {
			console.log('alarm data up to date');
		} else {
			console.log('updated alarms');
			alarms = alarmData;
			updateAlarmList();
		}
	});
}

function updateAlarmList() {
	const selectedListItem = $('.selected');
	const selectedId = (selectedListItem ? selectedListItem.getAttribute('data-id') : null);
	while (alarmList.firstChild) alarmList.removeChild(alarmList.lastChild);
	for (const a of alarms) {
		let listItem = document.createElement('div');
		listItem.setAttribute('data-id', a.id);
		listItem.onclick = selectAlarm.bind(null, a.id);

		let summaryText = document.createElement('div');
		summaryText.appendChild(document.createTextNode(a.summary));
		summaryText.classList.add('summary');

		let timeText = document.createElement('div');
		timeText.appendChild(document.createTextNode(formatTimestamp(a.time)));

		let agencyText = document.createElement('div');
		agencyText.appendChild(document.createTextNode(a.agency));

		let x = document.createElement('div');
		x.appendChild(agencyText);
		x.appendChild(timeText);
		x.classList.add('agency-timestamp-container')
		listItem.appendChild(x);

		listItem.appendChild(summaryText);

		listItem.classList.add('alarm-list-item');
		if (a.id === selectedId) listItem.classList.add('selected');
		alarmList.appendChild(listItem);
	}
}

function back() {
	$('#alarm-list').classList.add('focus');
	$('#alarm-info').classList.remove('focus');
}

function selectAlarm(id) {
	$('#alarm-list').classList.remove('focus');
	$('#alarm-info').classList.add('focus');
	lastSelectedListItem = $('.selected');
	if (lastSelectedListItem) lastSelectedListItem.classList.remove('selected');
	selectedListItem = $(`[data-id="${id}"]`);
	if (!selectedListItem) return;
	selectedListItem.classList.add('selected');
	showAlarmInfo(id);
}

function unitsContainer(alarm) {
	let unitsCont = document.createElement('div');
	unitsCont.classList.add('units-cont');
	let table = document.createElement('table');
	let head = document.createElement('tr');

	let headText = ['Unit', 'Disp', 'Enr', 'On Scn', 'In Svc'];
	for (let i = 0; i < headText.length; i++) {
		let txt = headText[i];
		let th = document.createElement('th');
		th.appendChild(document.createTextNode(txt));
		head.appendChild(th);
	}
	table.appendChild(head);

	for (let i = 0; i < alarm.units.length; i++) {
		let u = alarm.units[i];
		let tr = document.createElement('tr');

		let tdid = document.createElement('td');
		tdid.appendChild(document.createTextNode(u.id));
		tr.appendChild(tdid);

		let keys = ['dispatched', 'enroute', 'onScene', 'inService'];
		for (let i = 0; i < keys.length; i++) {
			let k = keys[i];
			let td = document.createElement('td');
			let text = document.createTextNode(u[k]);
			td.appendChild(text);
			tr.appendChild(td);
		}

		table.appendChild(tr);
	}

	unitsCont.appendChild(table);
	return unitsCont;
}

function alarmInfoItem(text) {
	let div = document.createElement('div');
	div.appendChild(document.createTextNode(text.toUpperCase()));
	return div;
}

function showAlarmInfo(id) {
	$('#agency-name-display').innerText = 'Loading';
	const details = $('#details');
	while (details.firstChild) details.removeChild(details.lastChild);
	get(`/alarm?id=${id}`)
	.then((alarm) => {
		console.log(alarm);
		$('#agency-name-display').innerText = alarm.agency;

		// ALARM INFO
		details.appendChild(sectionLabel('Alarm Info'));
		let alarmInfoCont = document.createElement('div');
		alarmInfoCont.classList.add('alarm-info-cont');
		let addr = document.createElement('div')
		addr.appendChild(document.createTextNode(alarm.address.toUpperCase()));
		addr.classList.add('address');
		alarmInfoCont.appendChild(addr);
		
		if (alarm.aux) alarm.aux.forEach(a => alarmInfoCont.appendChild(alarmInfoItem(`${a.name}: ${a.value}`)));

		if (alarm.latitude) {
			let mapBtn = document.createElement('a');
			mapBtn.href = `http://www.google.com/maps/place/${alarm.latitude},${alarm.longitude}`;
			mapBtn.target = '_blank';
			mapBtn.classList.add('map-btn');
			mapBtn.appendChild(document.createTextNode('OPEN IN MAP'));
			alarmInfoCont.appendChild(mapBtn);
		}
		details.appendChild(alarmInfoCont);
		
		// UNITS
		details.appendChild(sectionLabel('Units'));
		details.appendChild(unitsContainer(alarm));

		// NARRATIVE
		details.appendChild(sectionLabel('Narrative'));

		for (let i = 0; i < alarm.narrative.length; i++) {
			let n = alarm.narrative[i];
			let narrativeItem = document.createElement('div');
			narrativeItem.appendChild(document.createTextNode(`${n.time}: ${n.text}`));
			narrativeItem.classList.add('narrative-item');
			details.appendChild(narrativeItem);
		}

		let filler = document.createElement('div');
		filler.classList.add('details-end-filler');
		details.appendChild(filler);
	});
}

function sectionLabel(text) {
	let label = document.createElement('div');
	label.appendChild(document.createTextNode(text));
	label.classList.add('info-section-label');
	return label;
}

function formatTimestamp(ms) {
	let date = new Date(ms);
	let m = date.toLocaleString('default', { month: 'short' });
	let d = date.getDate();
	let time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
	return `${m} ${d} @ ${time}`;
}

function main() {
	alarmList = $('#alarm-list');
	updateAlarms();
	setInterval(updateAlarms, 15 * 1000);
}

document.body.onload = main;