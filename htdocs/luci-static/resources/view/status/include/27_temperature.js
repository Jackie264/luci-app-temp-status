'use strict';
'require baseclass';
'require rpc';

document.head.append(E('style', {'type': 'text/css'},
`
:root {
	--app-temp-status-font-color: #2e2e2e;
	--app-temp-status-border-color: var(--border-color-medium, #d4d4d4);
	--app-temp-status-hot-color: #fff7e2;
	--app-temp-status-overheat-color: #ffe9e8;
}
:root[data-darkmode="true"] {
	--app-temp-status-font-color: #fff;
	--app-temp-status-border-color: var(--border-color-medium, #444);
	--app-temp-status-hot-color: #8d7000;
	--app-temp-status-overheat-color: #a93734;
}
.temp-status-hot {
	background-color: var(--app-temp-status-hot-color) !important;
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-hot .td, .temp-status-hot td {
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-overheat {
	background-color: var(--app-temp-status-overheat-color) !important;
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-overheat .td, .temp-status-overheat td {
	color: var(--app-temp-status-font-color) !important;
}

.temp-status-temp-area {
	width: 100%;
	padding: 0 0 1em 0;
	display: flex;
	-webkit-align-items: flex-start;
	align-items: flex-start;
	-webkit-justify-content: space-evenly;
	justify-content: space-evenly; /* Change to uniform distribution */
	-webkit-flex-wrap: wrap;
	flex-wrap: wrap;
	-webkit-flex-direction: row;
	flex-direction: row;
}

/* --- Card transformation: only by modifying the original class --- */
.temp-status-list-item {
	display: flex !important;
	flex-direction: column !important;
	justify-content: space-between !important;
	align-items: center !important;
	flex-grow: 1;
	flex-shrink: 0;
	width: 100px !important; /* Desktop width */
	max-width: 100px !important;
	min-width: 70px !important;
	height: 100px !important;
	margin: 5px 4px !important;
	padding: 0 !important;
	border: 1px solid var(--app-temp-status-border-color) !important;
	border-radius: 4px;
	overflow: hidden;
	position: relative;
	background: rgba(0,0,0,0.02);
}

.temp-status-sensor-name {
	order: 1;
	width: 100%;
	height: 24px;
	line-height: 24px;
	background: rgba(0,0,0,0.05);
	font-size: 90%;
	font-weight: bold;
	text-align: center;
	padding: 0 1em 0 .5em !important;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	z-index: 2;
}

.temp-status-temp-value {
	order: 2;
	flex-grow: 1;
	width: 100% !important;
	margin: 0 !important;
	padding: 0 !important;
	text-align: center !important;
	font-weight: normal;
	font-size: 11px;
	display: flex !important;
	align-items: center !important;
	justify-content: center !important;
	z-index: 2;
}

/* Insert the thermometer icon */
.temp-status-temp-value::before {
	content: '🌡️';
	display: inline-block;
	font-size: 1em;
	margin-right: 5px;
	margin-bottom: 0;
}

/* Dynamic water level layer: controlled by variables --temp-ratio and --temp-color */
.temp-status-list-item::after {
	content: '';
	position: absolute;
	bottom: 0;
	left: 0;
	width: 100%;
	height: var(--temp-ratio, 0%);
	background: var(--temp-color, #52c41a);
	opacity: 0.12; /* A faint sense of watermark */
	transition: height 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	z-index: 1;
	pointer-events: none;
}

#temp-status-buttons-wrapper {
	margin-bottom: 1em;
}
.temp-status-button {
	display: inline-block;
	cursor: pointer;
	margin: 2px 2px 2px 0 !important;
	padding: 0 8px 0 4px;
	border: 1px dotted;
	-webkit-border-radius: 4px;
	-moz-border-radius: 4px;
	border-radius: 4px;
	opacity: 0.7;
}
.temp-status-button:hover {
	opacity: 0.9;
}
.temp-status-button:active {
	opacity: 1.0;
}
.temp-status-list-item .temp-status-hide-item {
	position: absolute;
	top: 0;
	right: 0;
	z-index: 10;
	cursor: pointer;
	margin: 0 !important;
	padding: .5em .5em !important;
	border: none !important;
	font-size: 10px;
	color: #bbb;
}
.temp-status-hide-item:hover {
	opacity: 1.0;
	color: #ff4d4f;
}

/* --- Mobile terminal adaptation: follow the principle of 20.5% width --- */
@media screen and (max-width: 480px) {
	.temp-status-list-item {
		flex-basis: 20.5% !important;
		max-width: 20.5% !important;
		aspect-ratio: 1 / 1 !important;
		height: auto !important;
		margin: 4px 1% !important;
	}
	.temp-status-sensor-name { font-size: 85% !important; font-weight: bold !important; height: 20px !important; line-height: 20px !important; }
	.temp-status-temp-value { font-size: 9px !important; padding: 0 !important; flex-grow: 1; }
}
`));

return baseclass.extend({
	title: _('Temperature'),
	viewName: 'temp-status',
	tempHot: 95,
	tempOverheat: 105,
	sensorsData: null,
	tempData: null,
	sensorsPath: [],
	hiddenItems: new Set(),
	hiddenNum: E('span', {}),
	tempTable: E('table', { 'class': 'table' }),
	tempArea: E('div', { 'class': 'temp-status-temp-area' }),
	tempView: E('div', {}),
	viewType: 'table',

	callSensors: rpc.declare({ object: 'luci.temp-status', method: 'getSensors', expect: { '': {} } }),
	callTempData: rpc.declare({ object: 'luci.temp-status', method: 'getTempData', params: [ 'tpaths' ], expect: { '': {} } }),

	formatTemp(mc) { return Number((mc / 1000).toFixed(1)); },
	sortFunc(a, b) { return (a.number > b.number) ? 1 : (a.number < b.number) ? -1 : 0; },

	restoreSettingsFromLocalStorage() {
		let hiddenItems = localStorage.getItem(`luci-app-${this.viewName}-hiddenItems`);
		if(hiddenItems) this.hiddenItems = new Set(hiddenItems.split(','));
		let view = localStorage.getItem(`luci-app-${this.viewName}-view`);
		if(view) this.viewType = view;
	},

	saveSettingsToLocalStorage() {
		localStorage.setItem(`luci-app-${this.viewName}-hiddenItems`, Array.from(this.hiddenItems).join(','));
		localStorage.setItem(`luci-app-${this.viewName}-view`, this.viewType);
	},

	makeTempTableContent() {
		this.tempTable.innerHTML = '';
		this.tempTable.append(
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th left', 'width': '33%' }, _('Sensor')),
				E('th', { 'class': 'th left' }, _('Temperature')),
				E('th', { 'class': 'th right', 'width': '1%' }, ' '),
			])
		);
		this.renderItems((path, name, temp, rowStyle, tpointsString) => {
			this.tempTable.append(E('tr', { 'class': 'tr' + rowStyle }, [
				E('td', { 'class': 'td left' }, (tpointsString.length > 0) ? `<span style="cursor:help; border-bottom:1px dotted" data-tooltip="${tpointsString}">${name}</span>` : name),
				E('td', { 'class': 'td left' }, (temp === null) ? '-' : temp + ' °C'),
				E('td', { 'class': 'td right' }, E('span', { 'class': 'temp-status-hide-item', 'click': () => this.hideItem(path) }, '&#935;'))
			]));
		});
		return this.tempTable;
	},

	makeTempAreaContent() {
		this.tempArea.innerHTML = '';
		this.renderItems((path, name, temp, itemStyle, tpointsString, ratio, color) => {
			this.tempArea.append(
				E('div', { 
					'class': 'temp-status-list-item' + itemStyle,
					'style': `--temp-ratio: ${ratio}%; --temp-color: ${color};` // In-in dynamic variables
				}, [
					E('span', { 'class': 'temp-status-hide-item', 'click': () => this.hideItem(path) }, '&#935;'),
					E('span', { 'class': 'temp-status-temp-value' }, (temp === null) ? '-' : temp + ' °C'),
					E('span', { 'class': 'temp-status-sensor-name' }, (tpointsString.length > 0) ? `<span data-tooltip="${tpointsString}">${name}</span>` : name)
				])
			);
		});
		return this.tempArea;
	},

	renderItems(callback) {
		if(!this.sensorsData || !this.tempData) return;
		for(let [k, v] of Object.entries(this.sensorsData)) {
			v.sort(this.sortFunc);
			for(let i of v) {
				let sensor = i.title || i.item;
				if(!i.sources) continue;
				i.sources.sort(this.sortFunc);
				for(let j of i.sources) {
					if(this.hiddenItems.has(j.path)) continue;
					let temp = (this.tempData[j.path] != null) ? this.formatTemp(this.tempData[j.path]) : null;
					let name = (j.label !== undefined) ? sensor + " / " + j.label : (j.item !== undefined) ? sensor + " / " + j.item.replace(/_input$/, "") : sensor;
					
					let tpointsString = '';
					let tempHot = this.tempHot, tempOverheat = this.tempOverheat;
					if(j.tpoints) {
						for(let tp of Object.values(j.tpoints)) {
							let t = this.formatTemp(tp.temp);
							tpointsString += `&#10;${tp.type}: ${t} °C`;
							if(['max','critical','emergency'].includes(tp.type)) tempOverheat = Math.min(tempOverheat, t);
							else if(tp.type == 'hot') tempHot = t;
						}
					}
					// Calculate the water level ratio and color
					let ratio = Math.min(Math.max((temp || 0) / tempOverheat, 0), 1) * 100;
					let color = (temp >= tempOverheat) ? '#ff4d4f' : (temp >= tempHot ? '#faad14' : '#52c41a');
					let style = (temp >= tempOverheat) ? ' temp-status-overheat' : (temp >= tempHot) ? ' temp-status-hot' : '';
					callback(j.path, name, temp, style, tpointsString, ratio, color);
				}
			}
		}
	},

	makeViewContent() {
		this.tempView.innerHTML = '';
		this.tempView.append((this.viewType == 'list') ? this.makeTempAreaContent() : this.makeTempTableContent());
		this.hiddenNum.textContent = this.hiddenItems.size;
		let unhide = document.getElementById('temp-status-unhide-all');
		if(unhide) unhide.style.display = (this.hiddenItems.size > 0) ? 'inline-block' : 'none';
	},

	hideItem(path) { this.hiddenItems.add(path); this.saveSettingsToLocalStorage(); this.makeViewContent(); },
	unhideAllItems() { this.hiddenItems.clear(); this.saveSettingsToLocalStorage(); this.makeViewContent(); },
	switchView() { this.viewType = (this.viewType == 'list') ? 'table' : 'list'; this.saveSettingsToLocalStorage(); this.makeViewContent(); },

	load() {
		this.restoreSettingsFromLocalStorage();
		return this.sensorsData ? (this.sensorsPath.length > 0 ? L.resolveDefault(this.callTempData(this.sensorsPath), null) : Promise.resolve(null)) : L.resolveDefault(this.callSensors(), null);
	},

	render(data) {
		if(data) {
			if(!this.sensorsData) {
				this.sensorsData = data.sensors;
				this.sensorsPath = data.temp ? Object.keys(data.temp) : [];
			}
			this.tempData = data.temp;
		}
		if(!this.sensorsData || !this.tempData) return E('div');
		this.makeViewContent();
		return E('div', { 'class': 'cbi-section' }, [
			E('div', { 'id': 'temp-status-buttons-wrapper' }, [
				E('span', { 'class': 'temp-status-button', 'click': () => this.switchView() }, _('Switch view')),
				E('span', { 'id': 'temp-status-unhide-all', 'class': 'temp-status-button', 'click': () => this.unhideAllItems() }, [ _('Show hidden sensors'), ' (', this.hiddenNum, ')' ])
			]),
			this.tempView
		]);
	}
});
