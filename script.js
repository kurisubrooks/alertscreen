var MapBoxGL = mapboxgl;
MapBoxGL.accessToken = 'pk.eyJ1Ijoia3VyaXN1YnJvb2tzIiwiYSI6ImNpdWw3Y3VrZDAwMGMydG1odDN1NmV5bjIifQ.bUSYwyLrHML0V6RLCX_APQ';

var turndown = new TurndownService();

var fireTypes = {
  'Bush Fire': 'Other+Fire',
  'Grass Fire': 'Other+Fire',
  'Hazard Reduction': 'Other+Fire',
  'Structure Fire': 'Other+Fire',
  'Burn off': 'Other+Fire',
  'MVA/Transport': 'Vehicle',
  'Assist Other Agency': 'Other',
  'Search/Rescue': 'Rescue',
  'Flood/Storm/Tree Down': 'Hazard',
  'Vehicle/Equipment Fire': 'Vehicle',
  'Fire Alarm': 'Alarm',
  'Haystack fire': 'Other+Fire',
  'Medical': 'Medical',
  'HAZMAT': 'HAZMAT',
  'Other': 'Other'
};

var map = new MapBoxGL.Map({
  container: 'map',
  style: 'mapbox://styles/kurisubrooks/cki29ft8y304619peh7635n7o',
  center: [150.911068, -33.801518],
  zoom: 9
});

map.addControl(new MapBoxGL.NavigationControl());

var app = new Vue({
  el: '#app',
  data: {
    count: {
      lvl0: 0,
      lvl1: 0,
      lvl2: 0,
      lvl3: 0
    },
    refreshed: null,
  },
  computed: {
    status() {
      return 'Last Refreshed: ' + this.refreshed;
    }
  }
});

var format = function(feature) {
  const alertLevels = [
    'Not Applicable',
    'Advice',
    'Watch and Act',
    'Emergency Warning'
  ];

  const properties = feature.properties;
  const description = turndown.turndown(properties.description).split('\n');
  const formatted = { };

  // Split Original String into Parsable Object
  for (const item of description) {
    description[item] = item.split(/:(.+)?/);
    description[item].splice(2, 1);
    description[item][1] = description[item][1].trim();
    formatted[description[item][0]] = description[item][1];
  }

  // if Level "Not Applicable" && Matches Blacklist, Remove
  /*
  if (alertLevels.indexOf(properties.category) === 0 && removeEvents.includes(formatted.TYPE)) {
    return false;
  }
  */

  // Format Data
  const data = {
    title: properties.title.trim(),
    guid: Number(properties.guid.replace('https://incidents.rfs.nsw.gov.au/api/v1/incidents/', '')),
    level: alertLevels.indexOf(properties.category),
    type: formatted.TYPE,
    category: properties.category,
    location: formatted.LOCATION,
    status: formatted.STATUS,
    updated: new Date(Date.parse(formatted.UPDATED)),
    size: Number(formatted.SIZE.replace(' ha', '')),
    geojson: {
      type: feature.type,
      geometry: feature.geometry,
      properties: {}
    }
  };

  // console.log(data);
  return data;
};

var getData = function () {
  return new Promise(function (resolve, reject) {
    fetch('https://api.kurisubrooks.com/api/fire?raw').then(function(res) {
    res.json().then(function(data) {
      console.log(data.data);

      var allLayers = { type: "FeatureCollection", features: [] };
      var emergencyLayer = { type: "FeatureCollection", features: [] };
      var watchLayer = { type: "FeatureCollection", features: [] };
      var adviceLayer = { type: "FeatureCollection", features: [] };
      var noneLayer = { type: "FeatureCollection", features: [] };

      data.data.features.forEach(element => {
        var level = element.properties.category;

        element.properties.icon =
          element.properties.category === 'Not Applicable'
            ? fireTypes[format(element).type] || 'Other'
            : element.properties.category;

        if (level === 'Not Applicable') {
          noneLayer.features.push(element);
        } else if (level === 'Advice') {
          adviceLayer.features.push(element);
        } else if (level === 'Watch and Act') {
          watchLayer.features.push(element);
        } else if (level === 'Emergency Warning') {
          emergencyLayer.features.push(element);
        }

        allLayers.features.push(element);
      });

      // update count
      Vue.set(app.count, 'lvl0', noneLayer.features.length);
      Vue.set(app.count, 'lvl1', adviceLayer.features.length);
      Vue.set(app.count, 'lvl2', watchLayer.features.length);
      Vue.set(app.count, 'lvl3', emergencyLayer.features.length);

      if (!map.getSource('fires')) {
        map.addSource('fires', { type: 'geojson', data: allLayers });
        map.addSource('emergency', { type: 'geojson', data: emergencyLayer });
        map.addSource('watch', { type: 'geojson', data: watchLayer });
        map.addSource('advice', { type: 'geojson', data: adviceLayer });
        map.addSource('nil', { type: 'geojson', data: noneLayer });
      } else {
        map.getSource('fires').setData(allLayers);
        map.getSource('emergency').setData(emergencyLayer);
        map.getSource('watch').setData(watchLayer);
        map.getSource('advice').setData(adviceLayer);
        map.getSource('nil').setData(noneLayer);
      }

      resolve();
    });
  });
});
};

var initMap = function () {
  map.addLayer({
    id: 'fire-outline',
    type: 'line',
    source: 'fires',
    paint: {
      'line-color': '#222222',
      'line-width': 2,
      'line-blur': 1
    }
  });

  map.addLayer({
    id: 'fire-zone',
    type: 'fill',
    source: 'fires',
    paint: {
      'fill-color': '#f9a82e',
      'fill-opacity': 0.4
    }
  });

  map.addLayer({
    id: 'fire-boundary',
    type: 'line',
    source: 'fires',
    paint: {
      'line-color': '#f9a82e',
      'line-width': 1,
    }
  });

  map.addLayer({
    id: 'notapplicable-bushfires',
    type: 'symbol',
    source: 'nil',
    layout: {
      'icon-image': '{icon}',
      'icon-allow-overlap': true
    },
    filter: ["==", "$type", "Point"]
  });

  map.addLayer({
    id: 'advice-bushfires',
    type: 'symbol',
    source: 'advice',
    layout: {
      'icon-image': '{icon}',
      'icon-allow-overlap': true
    },
    filter: ["==", "$type", "Point"]
  });

  map.addLayer({
    id: 'watch-bushfires',
    type: 'symbol',
    source: 'watch',
    layout: {
      'icon-image': '{icon}',
      'icon-allow-overlap': true
    },
    filter: ["==", "$type", "Point"]
  });

  map.addLayer({
    id: 'emergency-bushfires',
    type: 'symbol',
    source: 'emergency',
    layout: {
      'icon-image': '{icon}',
      'icon-allow-overlap': true
    },
    filter: ["==", "$type", "Point"]
  });
}

map.on('load', function () {
  getData().then(() => initMap());
  setInterval(() => getData(), 1 * 60 * 1000);
});

map.on('click', 'notapplicable-bushfires', e => popup(e));
map.on('click', 'advice-bushfires', e => popup(e));
map.on('click', 'watch-bushfires', e => popup(e));
map.on('click', 'emergency-bushfires', e => popup(e));

map.on('mouseenter', 'notapplicable-bushfires', () => map.getCanvas().style.cursor = 'pointer' );
map.on('mouseenter', 'advice-bushfires', () => map.getCanvas().style.cursor = 'pointer' );
map.on('mouseenter', 'watch-bushfires', () => map.getCanvas().style.cursor = 'pointer' );
map.on('mouseenter', 'emergency-bushfires', () => map.getCanvas().style.cursor = 'pointer' );

map.on('mouseleave', 'notapplicable-bushfires', () => map.getCanvas().style.cursor = '' );
map.on('mouseleave', 'advice-bushfires', () => map.getCanvas().style.cursor = '' );
map.on('mouseleave', 'watch-bushfires', () => map.getCanvas().style.cursor = '' );
map.on('mouseleave', 'emergency-bushfires', () => map.getCanvas().style.cursor = '' );

map.on('click', 'fire-zone', e => popup(e));

map.on('mouseenter', 'fire-zone', function () {
  map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'fire-zone', function () {
  map.getCanvas().style.cursor = '';
});

var currentlyOpen = null;
var currentLayer = 'fires';

var popup = function (e) {
  console.log(currentlyOpen, currentLayer, e.features[0]);
  var coordinates = e.features[0].geometry.coordinates.slice();
  var description = e.features[0].properties.description;

  console.log(description);

  /*
  if (currentLayer === e.features[0].layer.id && currentlyOpen === e.features[0].properties.guid) {
    return false;
  }

  currentlyOpen = e.features[0].properties.guid;
  currentLayer = e.features[0].layer.id;
  */

  if (e.features[0].geometry.type === 'Polygon') {
    coordinates = turf.centroid(turf.polygon(e.features[0].geometry.coordinates.slice())).geometry.coordinates;
  }

  new MapBoxGL.Popup({ maxWidth: 380 })
  .setLngLat(coordinates)
  .setHTML(description)
  .addTo(map);
}