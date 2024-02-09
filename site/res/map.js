const tilesetName='mapbox://yurukov.call-sofia-tileset';
const sName='call.sofia.tileset';
const slName='call-sofia-tileset-sourse';
mapboxgl.accessToken='[mappbox public token]';

const colorSchemeCharts = ["#fde0dd", "#fcc5c0", "#fa9fb5", "#f768a1", "#dd3497", "#ae017e", "#7a0177"].reverse();  
const colorSchemeMap = ["#feebe2", "#fcc5c0", "#fa9fb5", "#f768a1", "#dd3497", "#ae017e", "#7a0177"];  
const mapColorDomain = [20, 40, 80, 150, 300, 600];
const dateParse = d3.timeParse("%y%m%d");
const dateFormatPeriod = function(d) {
  if (d[0].getFullYear()==d[1].getFullYear())
    return monthName[d[0].getMonth()]+" и "+monthName[d[1].getMonth()]+" "+d[1].getFullYear();
  else
    return monthName[d[0].getMonth()]+" "+d[0].getFullYear()+" и "+monthName[d[1].getMonth()]+" "+d[1].getFullYear();
}
const formatPercentage = function(p) {
  if (p>0.05) return Math.ceil(p*100)+"%";
  if (p>=0.005) return (Math.ceil(p*1000)/10)+"%";
  return "<0.5%";
}
const formatPercContext = function(p,a) {
  if ((a && a.filters().length>0) || totalFiltered==callData.length)
    return formatPercentage(p/callData.length)+" от всички сигнали";
  else
    return formatPercentage(p/totalFiltered)+" от избраните сигнали";
}

const weekName = ['понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота', 'неделя'];
const monthName = ["яну.", "фев.", "март", "апр.", "май", "юни", "юли", "авг.", "сеп.", "окт.", "ное.", "дек."];
const catNames = {
  "1":"Чистота",
  "2":"Водоснабдяване и канализация",
  "3":"Пътна инфраструктура",
  "4":"Пътна сигнализация",
  "5":"Паркиране",
  "6":"Екология. Зелена система",
  "7":"Домашни и стопански животни",
  "8":"Търговия, реклама и преместваеми обекти",
  "9":"Сгради/строежи",
  "11":"Други",
  "22":"Проблеми с кучета",
  "27":"Сметосъбиране и сметоизвозване",
  "28":"Улично осветление",
  "30":"Замърсяване на обществени площи",
  "32":"Детски площадки",
  "38":"Масов градски транспорт",
  "39":"COVID-19",
  "40":"Спортни терени, площадки и съоръжения"
};
const stateNames = {  
  "0":"Неизвестен",
  "1":"Чакащ обработка",
  "2":"В процес на обработка",
  "3":"Очакващ отговор",
  "4":"Получил уведомление",
  "5":"Приключен",
  "6":"Отхвърлен"
};

class CallSofiaControl {
  constructor(opt) {
    this._classname = opt.classname || "";
    this._title = opt.title || "";
    this._action = opt.action || null;
  }

  onAdd(map) {
    this._map = map;
    this._container = d3.create('div');
    this._container.classed('mapboxgl-ctrl mapboxgl-ctrl-group',true);
    this._container.append('button')
      .classed(this._classname,true)
      .attr("type","button")
      .attr("aria-label",this._title)
      .attr("title",this._title)
      .on("click",this._action);
    return this._container.node();
  }
  onRemove() {
    this._container.remove();
    this._map = undefined;
  }
}

let callData=null, nameData=null, regionData=null, kvartalData=null, kvartalDataE=null, mapReady=false;
let progress={ 
    'init':{weight:3,count:1},
    'call-data':{weight:9, count:1},
    'kvartal-data':{weight:1, count:1},
    'region-data':{weight:1, count:1},
    'load-map':{weight:6, count:1},
    'source-data':{weight:4, count:1},
    'chart-init':{weight:3, count:2},
    'chart-render':{weight:1, count:6},
    'map-render':{weight:1, count:1}
  };
const expectedProgress=Object.values(progress).map(v=>v.weight*v.count).reduce((a,b)=>a+b);

processLoading('init');

d3.csv("data/call.sofia.dump.kvartali.csv",(d) => {
  d.id=+d.id;
  return d;
}).then((data) => {
  kvartalData=data;
  kvartalDataE=kvartalData.filter(d=>!d.name).map(d=>d.id)
  kvartalData.unshift({});
  processLoading('kvartal-data');
  initData();
});

d3.csv("data/call.sofia.dump.regions.csv",(d) => {
  d.id=+d.id;
  d.population_estimate=d.population_estimate!=""?+d.population_estimate:-1;
  return d;
}).then((data) => {
  regionData=data; 
  processLoading('region-data');
  initData();
});


d3.csv("data/call.sofia.reports.csv",(d) => {
  d.region=+d.region;
  d.kvartal=+d.kvartal;
  d.callid=+d.callid;
  d.category=+d.category;
  
  d.subm=dateParse(d.subm);
  d.subm_y=d.subm.getFullYear();
  d.subm_m=d.subm.getMonth()+1;
  d.subm_w=d.subm.getDay()-1;
  if (d.subm_w==-1) d.subm_w=6;

  d.laststate=+d.laststate;
  d.daystostate=+d.daystostate;
  return d;
}).then((data) => {
  callData=data; 
  processLoading('call-data');
  initData();
});

d3.csv("data/call.sofia.names.csv",(d)=>{
  d.callid=+d.callid;
  return d;
}).then((data) => {
  nameData=d3.map(data,d=>d.callid);
});

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/yurukov/ckzsdoxs4000e15pc2z23q7rq',
    center: [23.3155, 42.6824],
    maxZoom: 16,
    minZoom: 11.1,
    zoom: 12,
    pitch: 45,
    bearing: 0,
    antialias: true
});
const popup = new mapboxgl.Popup({
  anchor:"left", 
  offset: 10,
  closeOnClick: false, 
  closeButton: false
}).trackPointer();

const categoryChart = new dc.RowChart('#category-chart');
const regionChart = new dc.RowChart('#region-chart');
const kvartalChart = new dc.RowChart('#kvartal-chart');
const laststateChart = new dc.RowChart('#laststate-chart');
const daystostateChart = new dc.BarChart('#daystostate-chart');
const dayOfWeekChart = new dc.RowChart('#day-of-week-chart');
const monthChart = new dc.BarChart('#month-chart');
const yearChart = new dc.BarChart('#year-chart');

let xF, mapD, mapDG, regionD, kvartalD, categoryD, daystostateD, laststateD, yearD, monthD, weekD, heightScale, missingDataTiles=[],
    totalFiltered, lastFeatureSelected=null, filterShown=true, highOpacity=false, regionRelative=true, progressDoneCalled=false;
let mapHeightExpr = ["case",
              ['==', ['to-string',['var', 'height']], ''], "#d3d3d3",
              ["<=", ['var', 'height'], 0],  "#d3d3d3"];
  
mapColorDomain.forEach((cd,i)=> {
  mapHeightExpr.push(["<", ['var', 'height'], cd]);
  mapHeightExpr.push(colorSchemeMap[i]);
})
mapHeightExpr.push(colorSchemeMap[colorSchemeMap.length-1]);

map.addControl(new mapboxgl.FullscreenControl({container: document.querySelector('body')}));
map.addControl(new mapboxgl.NavigationControl({visualizePitch: true}));
map.addControl(new CallSofiaControl({
  classname:"filter-button",
  title:"Покажи филтрите", 
  action:toggleFilterPanel
}),"top-right");

map.addControl(new CallSofiaControl({
  classname:"opacity-button",
  title:"Смени прозрачността", 
  action:toggleOpacity
}),"top-right");


map.on('load', () => {

    processLoading('load-map');

    map.addSource(sName, {
      type: 'vector',
      url: tilesetName,
      promoteId: 'id'
    });

    map.addLayer({
      'id': slName,
      'type': 'fill-extrusion',
      'source': sName,
      'source-layer': slName,
      'filter': ['<=', ['get','id'], 0],
      'paint': {
        'fill-extrusion-height': [
          "let",
          "height", ['feature-state', 'height'],
          ["case",
            ['==', ['to-string',['var', 'height']], ''], 0,
            ['var', 'height']
          ]
        ],
        "fill-extrusion-color": [
          "let",
          "height", ['feature-state', 'height'],
          mapHeightExpr
        ],
        'fill-extrusion-opacity': highOpacity?.4:.8
      }
    });
})
.on('sourcedata', (e) => {
    if (!mapReady && e.isSourceLoaded && e.sourceId==sName && e.sourceCacheId=="other:"+sName) {
      mapReady=true;
      processLoading('source-data');
      initData();
    }
  })
.on('mousemove', slName, (e) => {
  if (e.features.length > 0) {
  lastFeatureSelected=e.features[0];
  popup
      .setHTML("<b>Сигнали:</b>"+e.features[0].state.calls)
      .addTo(map);
  } 
})
.on('mouseleave', slName, () => {
  lastFeatureSelected=null;
  popup.remove();
})
.on('click', printInfo);

dc.chartRegistry.list()
  .forEach(c=>c.on("postRender",()=>processLoading('chart-render')));

d3.selectAll("#map-overlay .closer").on("click",()=>{
    d3.select("#map-overlay")
      .transition()
        .duration(200)
        .on('start',()=>filterShown=false)
        .style("left",null);
});
d3.selectAll("#map-info .closer").on("click",()=>{
    d3.select("#map-info")
      .transition()
        .duration(200)
        .style("left",null);
});

function initData() {
  if (callData && regionData && kvartalData && mapReady) {
          
    map.on('zoomend',updateMapFilter);

    totalFiltered=callData.length;
    xF = crossfilter(callData);
    xF.onChange(eventType=> {
      if (eventType=="filtered") {
        updateMapFilter();
        updateChartFilters();
      }
    });

    yearD = xF.dimension((d) => d.subm_y);
    monthD = xF.dimension((d) => d3.timeMonth(d.subm));
    weekD = xF.dimension((d) => d.subm_w);
    categoryD = xF.dimension((d) => d.category);
    daystostateD = xF.dimension((d) => d.daystostate);
    laststateD = xF.dimension((d) => d.laststate);
    regionD = xF.dimension((d) => d.region);
    kvartalD = xF.dimension((d) => d.kvartal);

    mapD = xF.dimension((d) => d.id);
    mapDG = mapD.group().reduce((p,v)=>{
      ++p.count;
      p.calls.set(v.callid,v.category);
      return p;
    }, (p,v)=>{
      --p.count;
      p.calls.delete(v.callid);
      return p;
    }, ()=>{
      return {count:0, calls:new Map()};
    });

    heightScale = d3.scaleLinear()
      .domain([0,d3.max(mapDG.all().map(d=>d.value.count))])
      .range([0,1000]);
   
    categoryChart
      .width(320)
      .height(360)
      .margins({top: 5, left: 5, right: 5, bottom: 20})
      .group(categoryD.group().reduceCount())
      .dimension(categoryD)
      .ordinalColors(colorSchemeCharts)
      .label(d => catNames[d.key])
      .elasticX(true)
      .title(d => catNames[d.key]+": "+d.value+" или "+formatPercContext(d.value,categoryChart))
      .xAxis().ticks(4, ".0f");

    laststateChart
      .width(320)
      .height(180)
      .margins({top: 5, left: 5, right: 5, bottom: 20})
      .group(laststateD.group().reduceCount())
      .dimension(laststateD)
      .ordinalColors(colorSchemeCharts)
      .label(d => stateNames[d.key])
      .elasticX(true)
      .title(d => stateNames[d.key]+": "+d.value+" или "+formatPercContext(d.value,laststateChart))
      .xAxis().ticks(4, ".0f");

    regionChart
      .width(320)
      .height(450)
      .margins({top: 5, left: 5, right: 5, bottom: 20})
      .group(regionD.group().reduceCount())
      .dimension(regionD)
      .ordinalColors(colorSchemeCharts)
      .valueAccessor(d=>regionRelative?d.value/regionData[d.key].population_estimate*10000:d.value)
      .label(d => regionData[d.key].name)
      .elasticX(true)
      .title(d => regionRelative? Math.round(d.value/regionData[d.key].population_estimate*10000)+" на 10 хиляди живеещи в "+regionData[d.key].name
          :regionData[d.key].name+": "+d.value+" или "+formatPercContext(d.value,regionChart))
      .xAxis().ticks(4, ".0f");
    regionChart.ordering(d=>-(regionRelative?d.value/regionData[d.key].population_estimate:d.value));

    kvartalChart
      .width(320)
      .height(705)
      .margins({top: 5, left: 5, right: 5, bottom: 20})
      .group(kvartalD.group().reduceCount())
      .dimension(kvartalD)
      .data(g=>g.top(45).filter(d=>!kvartalDataE.includes(d.key)).slice(0,40))
      .ordinalColors(colorSchemeCharts)
      .valueAccessor(d=>d.value)
      .label(d => kvartalData[d.key].name)
      .elasticX(true)
      .title(d => kvartalData[d.key].name+": "+d.value+" или "+formatPercContext(d.value,kvartalChart))
      .xAxis().ticks(4, ".0f");
    kvartalChart.ordering(d=>-d.value);

    daystostateChart
      .width(320)
      .height(180)
      .margins({top: 5, left: 40, right: 5, bottom: 20})
      .dimension(daystostateD)
      .group(daystostateD.group().reduceCount())
      .elasticX(true)
      .renderHorizontalGridLines(true)
      .ordinalColors([colorSchemeCharts[1]])
      .round(Math.round)
      .controlsUseVisibility(true)
      .filterPrinter(d=>"между "+d[0][0]+" и "+d[0][1]+" дни след сигнала")
      .x(d3.scaleLinear())
      .y(d3.scaleLog().clamp(true)
          .domain(d3.extent(daystostateD.group().all().map(d=>d.value))))
      .xAxis().ticks(8, ".0f");
    daystostateChart.yAxis().ticks(8, ".0f");

    dayOfWeekChart
      .width(320)
      .height(180)
      .margins({top: 5, left: 5, right: 5, bottom: 20})
      .group(weekD.group().reduceCount())
      .dimension(weekD)
      .ordering((d)=>d.id)
      .ordinalColors(colorSchemeCharts)
      .label(d => weekName[d.key])
      .elasticX(true)
      .title(d => weekName[d.key]+": "+d.value+" или "+formatPercContext(d.value,dayOfWeekChart))
      .xAxis().ticks(6, ".0f");

    monthChart
      .width(320)
      .height(180)
      .margins({top: 5, left: 40, right: 5, bottom: 20})
      .dimension(monthD)
      .group(monthD.group().reduceCount())
      .elasticX(true)
      .elasticY(true)
      .gap(-4)
      .outerPadding(0)
      .round(d3.timeMonth.round)
      .controlsUseVisibility(true)
      .filterPrinter(d=>"подадени между "+dateFormatPeriod(d[0]))
      .renderHorizontalGridLines(true)
      .ordinalColors([colorSchemeCharts[1]])
      .xAxisPadding(1)
      .xAxisPaddingUnit(d3.timeMonth)
      .x(d3.scaleTime())
      .yAxis().ticks(6, ".0f");

    yearChart
      .width(320)
      .height(180)
      .margins({top: 5, left: 40, right: 5, bottom: 20})
      .dimension(yearD)
      .group(yearD.group().reduceCount())
      .elasticY(true)
      .gap(2)
      .outerPadding(0.1)
      .renderHorizontalGridLines(true)
      .ordinalColors([colorSchemeCharts[1]])
      .title(d => d.key+" г.: "+d.value+" или "+formatPercContext(d.value,yearChart))
      .x(d3.scaleBand())
      .xUnits(dc.units.ordinal)
      .yAxis().ticks(6, ".0f");

    processLoading('chart-init');

    map.on('render', () => {
      processLoading('map-render');
      map.off('render');
    });

    laststateChart.filter([[2,3,4,5]]);
    dc.renderAll();
    updateMapFilter();
    updateChartFilters();
    map.setFilter(slName, null);
    
    processLoading('chart-init');
    setTimeout(progressDone,1000);    
  }
}

function updateChartFilters() {
    totalFiltered=xF.allFiltered().length;
    d3.select("#title-chart i")
      .text(totalFiltered+(totalFiltered==callData.length?"":" или "+formatPercentage(totalFiltered/callData.length)));
}

function updateMapFilter() {
  const mapDGAll = mapDG.all();
  const mapDGAllM = d3.map(mapDGAll,d=>d.key);

  map.querySourceFeatures(sName, {sourceLayer: slName})
    .forEach((f)=> {
      const d = mapDGAllM.get(f.id);
      if (!d && !missingDataTiles.includes(f.id)) 
        missingDataTiles.push(f.id);
      const value = d?d.value.count:0;
      map.setFeatureState({
        source: sName,
        sourceLayer: slName,
        id: f.id,
      }, {
        height: heightScale(value),
        calls: value
      });
    });

  let mapDGAllF = mapDGAll.filter(d=>d.value.count==0).map(d=>d.key);
  if (mapDGAllF.length==0) {
    mapDGAllF = null;
  } else if (mapDGAllF.length>mapDGAll.length*.6) {
    mapDGAllF = mapDGAll.filter(d=>d.value.count>0).map(d=>d.key);
    mapDGAllF = ['in', ['get', 'id'], ['literal', mapDGAllF]];
  } else {
    if (missingDataTiles)
      mapDGAllF = mapDGAllF.concat(missingDataTiles);
    mapDGAllF = ['!', ['in', ['get', 'id'], ['literal', mapDGAllF]]];
  }

  map.setFilter(slName, mapDGAllF);
}

function printInfo() {
  let callList=false;
  const mapInfo=d3.select("#map-info");
  if (lastFeatureSelected) {
    const groupList = mapDG.all().filter(g=>g.key==lastFeatureSelected.properties.id)
    if (groupList.length>0) {
      callList="";
      d3.nest()
        .key(d=>d[1]).sortKeys(d3.ascending)
        .entries([...groupList[0].value.calls],d=>d[1])
        .sort((a,b)=>b.values.length-a.values.length)
        .forEach((v)=>{
          callList+="<li>"+catNames[v.key]+"<ul>";
          v.values.reverse().forEach(vl=>{
            let name=nameData?nameData.get(vl[0]):false;
            if (typeof name != "undefined" && name) {
              name=name.name;
              if (name.length==30) name+="...";
            } else
              name="Сигнал №"+vl[0];

            callList+="<li><a href='https://call.sofia.bg/bg/Signal/Details?id="+vl[0]+"' target='_blankc'>"+name+"</a></li>";
          });
          callList+="</ul></li>";
        });
    mapInfo.selectAll("ul")
      .remove();
    mapInfo
      .append("ul")
      .html(callList);
    mapInfo.select("h3")
      .text(groupList[0].value.count+" сигналa на това място");
    mapInfo
      .transition()
        .duration(500)
        .style("left","0px");
    }
  } 

  if (!callList) {
    mapInfo
      .transition()
        .duration(200)
        .style("left",null);
  }
}

function toggleOpacity() {
  highOpacity=!highOpacity;
  map.setPaintProperty(slName, 'fill-extrusion-opacity', highOpacity?.4:.8); 
}

function toggleRegionFilterType() {
  regionRelative=!regionRelative; 
  d3.select("#region-chart-type").text(regionRelative?"всички сигнали":"спрямо население");
  regionChart.redraw();
}

function toggleFilterPanel() {
  d3.select("#map-overlay")
    .transition()
      .duration(filterShown?200:500)
      .on("start", () => filterShown=!filterShown)
      .style("left",filterShown?null:"0px");
  d3.select("#map-info")
    .transition()
      .duration(200)
      .style("left",null);
}

function processLoading(label) {
  if (progress) {
    if (progress[label] && progress[label].count>0)
      progress[label].count--;

    let current = Object.values(progress).map(v=>v.weight*v.count).reduce((a,b)=>a+b);
    current = Math.ceil(100*(1-current/expectedProgress));
    if (current==100) progress=false;
    if (current>0)
      d3.select("body")
        .transition()
        .duration(current==100?200:600)
        .on("start", () => { 
          d3.select("#progress-counter h1")
            .text(current+"%");
        })
        .on("end", () => { 
          if (!progress) {
            progressDone();
          }
        })
        .style("background","linear-gradient(to bottom, lightgray "+current+"%, white 0%)");
  } 
}

function progressDone() {
  if (progressDoneCalled) return;
  progressDoneCalled=true;
  d3.select("#progress-counter").remove();
  d3.selectAll("body>div").style("visibility",null);
  if (window.innerWidth<800) {
    setTimeout(()=>{
      d3.select("#map-overlay")
        .transition()
          .duration(200)
          .on('start',()=>filterShown=false)
          .style("left",null);
      d3.select(".filter-button")
        .transition()
        .duration(500)
        .ease(d3.easeBounceOut)
        .style("background-color","red")
        .on("end",()=>
          d3.select(".filter-button")
            .transition()
            .duration(500)
            .ease(d3.easeBounceOut)
            .style("background-color","transparent")
        );
    },2000);
  }
}


