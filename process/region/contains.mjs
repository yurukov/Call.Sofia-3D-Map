import inside from 'point-in-polygon';
import fs from "fs";
var geojsonR = JSON.parse(fs.readFileSync("sofia.regions.json", "utf8"));
var geojsonK = JSON.parse(fs.readFileSync("sofia.kvartali.json", "utf8"));
var pR=0,pK=0;

var point=JSON.parse(process.argv[2]);

for (var k=0;k<geojsonR.features.length;k++) {
  var feature = geojsonR.features[k];
  var shape = feature.geometry.coordinates;
  if (feature.geometry.type=='Polygon')
    shape=[shape];

  var isInside=false;
  for (var i=0;i<shape.length;i++) {
    for (var j=0;j<shape[i].length;j++) {
      if (inside(point, shape[i][j])) 
        isInside = j==0;
    }
    if (isInside)
      break;
  }

  if (isInside) {
    pR=parseInt(feature.properties.obns_num);
    break;
  }
}

for (var k=0;k<geojsonK.features.length;k++) {
  var feature = geojsonK.features[k];
  var shape = feature.geometry.coordinates;
  if (feature.geometry.type=='Polygon')
    shape=[shape];

  var isInside=false;
  for (var i=0;i<shape.length;i++) {
    for (var j=0;j<shape[i].length;j++) {
      if (inside(point, shape[i][j])) 
        isInside = j==0;
    }
    if (isInside)
      break;
  }

  if (isInside) {
    pK=parseInt(feature.properties.id);
    break;
  }
}

console.log(pR+","+pK);

