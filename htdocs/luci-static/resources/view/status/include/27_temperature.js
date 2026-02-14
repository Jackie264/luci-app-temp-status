'use strict';
'require baseclass';
'require rpc';

document.head.append(E('style', {'type': 'text/css'},
`
/* --- 原版样式：完全保留 --- */
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
	justify-content: space-evenly; /* 改为均匀分布 */
	-webkit-flex-wrap: wrap;
	flex-wrap: wrap;
	-webkit-flex-direction: row;
	flex-direction: row;
}

/* --- 卡片化改造：仅通过修饰原版 class 实现 --- */
.temp-status-list-item {
	display: flex !important;
	flex-direction: column !important;
	justify-content: space-between !important;
	align-items: center !important;
	flex-grow: 1;
	flex-shrink: 0;
	width: 100px !important; /* 桌面端宽度 */
	max-width: 100px !important;
	min-width: 70px !important;
	height: 95px !important;
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
	font-size: 11px;
	text-align: center;
	padding: 0 4px !important;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.temp-status-temp-value {
	order: 2;
	width: 100% !important;
	margin: 0 !important;
	padding: 15px 0 5px 0 !important;
	text-align: center !important;
	font-weight: bold;
	font-size: 13px;
}

/* 插入温度计图标 */
.temp-status-temp-value::before {
	content: '🌡️';
	display: block;
	font-size: 1.2em;
	margin-bottom: 4px;
}

.temp-status-hide-item {
	position: absolute;
	right: 0;
	top: 0;
	z-index: 10;
	margin: 0 !important;
	padding: 0 4px !important;
	border: none !important;
	font-size: 14px;
	color: #bbb;
}

#temp-status-buttons-wrapper { margin-bottom: 1em; }
.temp-status-button {
	display: inline-block;
	cursor: pointer;
	margin: 2px 4px 2px 0 !important;
	padding: 2px 4px;
	border: 1px dotted;
	-webkit-border-radius: 4px;
	-moz-border-radius: 4px;
	border-radius: 4px;
	opacity: 0.7;
}
.temp-status-button:hover { opacity: 0.9; }

/* --- 手机端适配：遵循 20.5% 宽度原则 --- */
@media screen and (max-width: 480px) {
	.temp-status-list-item {
		flex-basis: 20.5% !important;
		max-width: 20.5% !important;
		margin: 4px 1% !important;
	}
	.temp-status-sensor-name { font-size: 9px !important; height: 20px !important; line-height: 20px !important; }
	.temp-status-temp-value { font-size: 10px !important; padding: 10px 0 5px 0 !important; }
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
		this.renderItems((path, name, temp, itemStyle, tpointsString) => {
			this.tempArea.append(
				E('div', { 'class': 'temp-status-list-item' + itemStyle }, [
					E('span', { 'class': 'temp-status-hide-item', 'click': () => this.hideItem(path) }, '&#935;'),
					E('span', { 'class': 'temp-status-temp-value' }, (temp === null) ? '-' : temp + ' °C'),
					E('span', { 'class': 'temp-status-sensor-name' }, (tpointsString.length > 0) ? `<span data-tooltip="${tpointsString}">${name}</span>` : name)
				])
			);
		});
		return this.tempArea;
	},

	// 提炼公共渲染逻辑，完全遵循原版的数据处理流程
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
					let style = (temp >= tempOverheat) ? ' temp-status-overheat' : (temp >= tempHot) ? ' temp-status-hot' : '';
					callback(j.path, name, temp, style, tpointsString);
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
