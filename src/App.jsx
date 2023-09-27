import './App.css';
import { useState, useEffect } from 'react';

const timestamp = (ms) => {
	const date = new Date(ms);
	const m = date.toLocaleString('en-US', { month: 'short' });
	const d = date.getDate();
	const time = date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
	return `${m} ${d} @ ${time}`;
};

const AlarmListItem = ({ gist, selected, selectAlarm }) => {
	const className = `alarm-list-item${selected ? ' selected' : ''}`;
	return (
		<li
			className={className}
			onClick={() => {
				selectAlarm(gist.id);
			}}
		>
			<div className='alarm-list-item-header'>
				<span>{gist.agency}</span>
				<span>{timestamp(gist.time)}</span>
			</div>
			<span className='alarm-list-item-summary'>{gist.summary}</span>
		</li>
	);
};

function App() {
	const [listHasFocus, setListHasFocus] = useState(true);
	const [alarmGists, setAlarmGists] = useState([]);
	const [selectedAlarmID, setSelectedAlarmID] = useState(null);
	const [selectedAlarmData, setSelectedAlarmData] = useState(null);
	const [fetchingAlarm, setFetchingAlarm] = useState(false);
	const [alarmError, setAlarmError] = useState(false);

	const selectAlarm = async (id) => {
		setSelectedAlarmID(id);
		setSelectedAlarmData(null);
		setFetchingAlarm(true);
		setAlarmError(false);
		setListHasFocus(false);
		try {
			const response = await fetch(`/alarm?id=${id}`);
			const alarmData = await response.json();
			if (alarmData.id === id) {
				setSelectedAlarmData(alarmData);
				setFetchingAlarm(false);
			}
		} catch (e) {
			if (selectedAlarmID === id) {
				setAlarmError(true);
				setFetchingAlarm(false);
			}
			console.error(`failed to get alarm ${id}`);
		}
	};

	const updateAlarmGists = async () => {
		const url = '/gists';
		try {
			const response = await fetch(url);
			const gists = await response.json();
			setAlarmGists(gists);
		} catch (e) {
			console.error('failed to get updated gists');
		}
	};

	useEffect(() => {
		updateAlarmGists();
		const updateGistsInterval = setInterval(() => {
			updateAlarmGists();
		}, 15 * 1000);
		return () => clearInterval(updateGistsInterval);
	}, []);

	useEffect(() => {
		// iOS Safari scrolling issues
		const preventWindowScroll = (e) => {
			e.preventDefault();
			window.scrollTo(0, 0);
		};
		window.addEventListener('scroll', preventWindowScroll);
		return () => window.removeEventListener('scroll', preventWindowScroll);
	}, []);

	return (
		<>
			<ol id='alarm-list' className={listHasFocus ? 'focus' : null}>
				{alarmGists.map((g) => (
					<AlarmListItem
						key={g.id}
						gist={g}
						selected={selectedAlarmID === g.id}
						selectAlarm={selectAlarm}
					/>
				))}
			</ol>
			<section id='alarm-info' className={listHasFocus ? null : 'focus'}>
				<h1 id='alarm-info-section-header'>
					{selectedAlarmData === null
						? fetchingAlarm
							? 'Fetching Alarm'
							: alarmError
							? 'Failed to Fetch Alarm'
							: 'No Alarm Selected'
						: selectedAlarmData.agency}
				</h1>
				{selectedAlarmData === null ? null : (
					<div id='details-cont'>
						<div id='details'>
							<section>
								<div className='detail-section-label'>
									<h2>Alarm Info</h2>
									<span>{timestamp(selectedAlarmData.time)}</span>
								</div>
								<div className='detail-section-container'>
									<a
										className='address'
										href={`https://www.google.com/maps/place/${selectedAlarmData.latitude},${selectedAlarmData.longitude}`}
										target='_blank'
									>
										{selectedAlarmData.address}
									</a>
									<table>
										<tbody>
											{selectedAlarmData.aux.map((a) => (
												<tr className='aux-data-item' key={a.id}>
													<td>{a.name}</td>
													<td>{a.value}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</section>
							<section>
								<div className='detail-section-label'>
									<h2>Units</h2>
								</div>
								<div className='detail-section-container'>
									<table id='units-table'>
										<thead>
											<tr>
												<th>Unit</th>
												<th>
													<abbr title='Dispatched'>Disp</abbr>
												</th>
												<th>
													<abbr title='Enroute'>Enr</abbr>
												</th>
												<th>
													<abbr title='On Scene'>On Scn</abbr>
												</th>
												<th>
													<abbr title='In Service'>In Svc</abbr>
												</th>
											</tr>
										</thead>
										<tbody>
											{selectedAlarmData.units.map((u) => (
												<tr key={u.id}>
													<td>{u.name}</td>
													<td>{u.dispatched}</td>
													<td>{u.enroute}</td>
													<td>{u.onScene}</td>
													<td>{u.inService}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</section>
							<section>
								<div className='detail-section-label'>
									<h2>Narrative</h2>
								</div>
								<ul>
									{selectedAlarmData.narrative.map((n) => (
										<li className='narrative-item' key={n.id}>
											{n.time}: {n.text}
										</li>
									))}
								</ul>
							</section>
							<div id='details-end-filler'></div>
						</div>
					</div>
				)}
				<div id='back-button' onClick={() => setListHasFocus(true)}>
					<img src='./back-arrow.svg' />
				</div>
			</section>
		</>
	);
}

export default App;
