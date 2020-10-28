frappe.ui.form.ControlFrontechCustomField = frappe.ui.form.ControlData.extend({
	horizontal: false,
	// mousePressed: false,
	// lastX: 0, 
	// lastY: 0,
	// ctx: null,
	make_wrapper() {
		// Create the elements for map area
		this._super();

		let $input_wrapper = this.$wrapper.find('.control-input-wrapper');
		this.map_id = frappe.dom.get_unique_id();
		this.map_area = $(
			`<div class="map-wrapper border">
				<div id="` + this.map_id + `" style="min-height: 600px; z-index: 1; max-width:100%"></div>
			</div>`
		);
		this.map_area.prependTo($input_wrapper);
		this.$wrapper.find('.control-input').addClass("hidden");

		if ($input_wrapper.is(':visible')) {
			this.make_map();
		} else {
			$(document).on('frappe.ui.Dialog:shown', () => {
				this.make_map();
			});
		}
	},

	make_map() {
		this.bind_leaflet_map();
		this.bind_leaflet_draw_control();
		this.bind_leaflet_locate_control();
		this.bind_leaflet_refresh_button();
	},
	
	format_for_input(value) {
		if (!this.map) return;
		console.log('frontech custom field');
		// render raw value from db into map
		var me = this;
		this.clear_editable_layers();
		console.log(value);
		if(value) {
			console.log("Second layer");
			var data_layers = new L.FeatureGroup()
				.addLayer(L.geoJson(JSON.parse(value),{
					pointToLayer: function(geoJsonPoint, latlng) {
						console.log('\ngeoJsonPoint ',geoJsonPoint, latlng);
						if (geoJsonPoint.properties.point_type == "circle"){
							return L.circle(latlng, {radius: geoJsonPoint.properties.radius});
						} else if (geoJsonPoint.properties.point_type == "circlemarker") {
							return L.circleMarker(latlng, {radius: geoJsonPoint.properties.radius});
						}
						else {
							
							var url = frappe.get_route()
							console.log('frappe.get_route()   ',frappe.get_route());
							// this is the marker logic
							// var url = window.location.href.split("/");
							// console.log('\n\nurl  ',url);
							var docTypeName = url[1]
							var row = url[2];
							var myPopup = null;
							var request = new XMLHttpRequest();
							console.log(docTypeName,row)
							request.open('GET', "api/resource/" + docTypeName + "/" + row, false);  // `false` makes the request synchronous
							request.send(null);
							console.log('68 ',request);
							
							if (request.status == 200){

								// get all info for current state
								var requestData = JSON.parse(request.response).data;
								console.log('request Data   ', requestData);
								var frontech_cus_geolocation_valid = requestData.frontech_custom_geolocation
								if (frontech_cus_geolocation_valid!=null && JSON.parse(requestData.frontech_custom_geolocation).features!=undefined){
									
									var frontech_geo = JSON.parse(requestData.frontech_custom_geolocation).features
									console.log('\ninside validation', frontech_geo);
									// console.log('request frontech_geo   ', frontech_geo);
									for (var i = 0; i < frontech_geo.length; i++){
										// console.log(geoJsonPoint, frontech_geo[i].geometry.coordinates, 
										// 	JSON.stringify(frontech_geo[i].geometry.coordinates)==JSON.stringify(geoJsonPoint.geometry.coordinates));
										
										// if equal, it means that it has the marker's data in the database. 
										if (JSON.stringify(frontech_geo[i].geometry.coordinates)==JSON.stringify(geoJsonPoint.geometry.coordinates)){
											console.log('I am in, they are equal');
											var featureProperty = frontech_geo[i].properties

											// Check if the marker's geolocation has a file or not.
											// if the current location has a file:
											if (featureProperty.filePath != undefined){
												console.log('with image \n');
												myPopup = L.DomUtil.create('div', 'infoWindow');
												myPopup.innerHTML = `
													<input type="file" id='floorplan${geoJsonPoint.geometry.coordinates[0].toString() + geoJsonPoint.geometry.coordinates[1].toString()}' name='plan'>
													<button type='button' class = 'upload_img_button'>Replace</button>

													<a href="${featureProperty.filePath}" download><p>Download: ${featureProperty.filePath.substr(29)}</p></a>
												`;

												$('.upload_img_button', myPopup).on('click', function(data) {
													
													var file = document.getElementById('floorplan'+geoJsonPoint.geometry.coordinates[0].toString() + geoJsonPoint.geometry.coordinates[1].toString()).files[0];
													// console.log('file  ',file);
													if (file){
														frappe.confirm('This will be replacing the previous file. Are you sure you want to proceed?',
														() => {
															let xhr = new XMLHttpRequest();
															xhr.open('POST', '/api/method/upload_file', false);
															xhr.setRequestHeader('Accept', 'application/json');
															xhr.setRequestHeader('X-Frappe-CSRF-Token', frappe.csrf_token);
															let form_data = new FormData();
															
															var validFileName = me.getValidFileName(file.name);
															form_data.append('file', file, validFileName);
															form_data.append('file_url', '/files/'+validFileName);
															xhr.send(form_data);
															
															var result = JSON.parse(requestData.frontech_custom_geolocation);
															// console.log('custom_geolocation.frontech_custom_geolocation ', custom_geolocation.frontech_custom_geolocation);
															// console.log('frontech custom field 69 result',result);
															// console.log('geojsonpoint   ',geoJsonPoint);
															for (var feature of result.features){
																// console.log('feature  ', feature);
																if (JSON.stringify(feature.geometry.coordinates) == JSON.stringify(geoJsonPoint.geometry.coordinates)){
																	feature.properties['filePath'] = '/files/'+validFileName
																}
															}
															frappe.call({
																url: '/api/resource/'+ docTypeName +"/"+ row,
																type: "PUT",
																args: {
																	data: {"frontech_custom_geolocation": JSON.stringify(result)}
																},
																callback: function(r) {
																	console.log(JSON.stringify(r));
																	frappe.show_alert({
																		message:__('Uploaded. This page is going to reload after 5 seconds'),
																		indicator:'green'
																	}, 5);
																	setTimeout(function(){ location.reload(true); }, 5000);
																	
																	// $.get("/api/method/frappe.desk.form.load.getdoc?doctype=Custom Floorplan&name="+row, function( data ){
																	// 	console.log('refreshed!!!!!\n');
																	// })
																}
															});

														}, () => {
															console.log('confirm No ');
															// action to perform if No is selected
														})
													}
													else{
														frappe.throw(__('Please upload a file first!'));
													}
												});

												console.log('\n167 mypopup', latlng, myPopup);
												return L.marker(latlng).bindPopup(myPopup);
											}
											
											// The current location does not have a file:
											else{
												console.log('without image \n');
												myPopup = L.DomUtil.create('div', 'infoWindow');
												myPopup.innerHTML = "<input type='file' id='floorplan" + geoJsonPoint.geometry.coordinates[0].toString() + geoJsonPoint.geometry.coordinates[1].toString() +"' name='plan'><button type='button' class = 'upload_img_button'>Upload</button>";
												// if the file exists
												$('.upload_img_button', myPopup).on('click', function(data) {
													var file = document.getElementById('floorplan'+geoJsonPoint.geometry.coordinates[0].toString() + geoJsonPoint.geometry.coordinates[1].toString()).files[0];
													if (file){
														// console.log('\n\n\nhere',data);
														// console.log(document.getElementById('floorplan'+geoJsonPoint.geometry.coordinates[0].toString() + geoJsonPoint.geometry.coordinates[1].toString()).files[0]);
														let xhr = new XMLHttpRequest();
														xhr.open('POST', '/api/method/upload_file', false);
														xhr.setRequestHeader('Accept', 'application/json');
														xhr.setRequestHeader('X-Frappe-CSRF-Token', frappe.csrf_token);
														let form_data = new FormData();
														
														var validFileName = me.getValidFileName(file.name);
														form_data.append('file', file, validFileName);
														form_data.append('file_url', '/files/'+validFileName);
														xhr.send(form_data);
														
														var result = JSON.parse(requestData.frontech_custom_geolocation);
														// console.log('custom_geolocation.frontech_custom_geolocation ', custom_geolocation.frontech_custom_geolocation);
														// console.log('frontech custom field 69 result',result);
														// console.log('geojsonpoint   ',geoJsonPoint);
														for (var feature of result.features){
															// console.log('feature  ', feature);
															if (JSON.stringify(feature.geometry.coordinates) == JSON.stringify(geoJsonPoint.geometry.coordinates)){
																feature.properties['filePath'] = '/files/'+validFileName
															}
														}
														
														frappe.call({
															url: '/api/resource/' + docTypeName + '/' + row,
															type: "PUT",
															args: {
																data: {"frontech_custom_geolocation": JSON.stringify(result)}
															},
															callback: function(r) {
																console.log(JSON.stringify(r));
																frappe.show_alert({
																	message:__('Uploaded. This page is going to reload after 5 seconds'),
																	indicator:'green'
																}, 5);
																setTimeout(function(){ location.reload(true); }, 5000);
															}
														});
													}else{
														frappe.throw(__('Please upload a file first!'));
													}
												});
												console.log('does not have any files');
												return L.marker(latlng).bindPopup(myPopup);
											}
										}
									}
									myPopup = L.DomUtil.create('div', 'infoWindow');
									myPopup.innerHTML = "<input type='file' id='floorplan" + geoJsonPoint.geometry.coordinates[0].toString() + geoJsonPoint.geometry.coordinates[1].toString() +"' name='plan'><button type='button' class = 'upload_img_button'>Upload</button>";
									$('.upload_img_button', myPopup).on('click', function(data) {
										var file = document.getElementById('floorplan'+geoJsonPoint.geometry.coordinates[0].toString() + geoJsonPoint.geometry.coordinates[1].toString()).files[0];
										if (file){
											// console.log('\n\n\nhere',data);
											// console.log(document.getElementById('floorplan'+geoJsonPoint.geometry.coordinates[0].toString() + geoJsonPoint.geometry.coordinates[1].toString()).files[0]);
											let xhr = new XMLHttpRequest();
											xhr.open('POST', '/api/method/upload_file', false);
											xhr.setRequestHeader('Accept', 'application/json');
											xhr.setRequestHeader('X-Frappe-CSRF-Token', frappe.csrf_token);
											let form_data = new FormData();
											
											var validFileName = me.getValidFileName(file.name);
											form_data.append('file', file, validFileName);
											form_data.append('file_url', '/files/'+validFileName);
											xhr.send(form_data);
											
											// here is actually the problem. when we have created a new marker, 
											// we need to update it to database, not only update the file path

											$.get("api/resource/"+docTypeName+"/"+row, function(data, status){
												var custom_geolocation = data.data;
												var result = JSON.parse(custom_geolocation.frontech_custom_geolocation)
												result.features.push({
													"type": "Feature",
													"properties": {
														"filePath": '/files/'+validFileName
													},
													"geometry": {
														"type": "Point",
														"coordinates": geoJsonPoint.geometry.coordinates
													}
												});
												frappe.call({
													url: '/api/resource/'+docTypeName+ '/' + row,
													type: "PUT",
													args: {
														data: {"frontech_custom_geolocation": JSON.stringify(result)}
													},
													callback: function(r) {
														console.log(JSON.stringify(r));
														frappe.show_alert({
															message:__('Uploaded. This page is going to reload after 5 seconds'),
															indicator:'green'
														}, 5);
														setTimeout(function(){ location.reload(true); }, 5000);
													}
												});
											});
										}else{
											frappe.throw(__('Please upload a file first!'));
										}
										
									});
									return L.marker(latlng).bindPopup(myPopup);
								}else{
									// a new row 
									myPopup = L.DomUtil.create('div', 'infoWindow');
									myPopup.innerHTML = "<input type='file' id='floorplan" + geoJsonPoint.geometry.coordinates[0].toString() + geoJsonPoint.geometry.coordinates[1].toString() +"' name='plan'><button type='button' class = 'upload_img_button'>Upload</button>";
									$('.upload_img_button', myPopup).on('click', function(data) {
										var file = document.getElementById('floorplan'+geoJsonPoint.geometry.coordinates[0].toString() + geoJsonPoint.geometry.coordinates[1].toString()).files[0];
										if (file){
											// console.log('\n\n\nhere',data);
											// console.log(document.getElementById('floorplan'+geoJsonPoint.geometry.coordinates[0].toString() + geoJsonPoint.geometry.coordinates[1].toString()).files[0]);
											let xhr = new XMLHttpRequest();
											xhr.open('POST', '/api/method/upload_file', false);
											xhr.setRequestHeader('Accept', 'application/json');
											xhr.setRequestHeader('X-Frappe-CSRF-Token', frappe.csrf_token);
											let form_data = new FormData();
											
											var validFileName = me.getValidFileName(file.name);
											form_data.append('file', file, validFileName);
											form_data.append('file_url', '/files/'+validFileName);
											xhr.send(form_data);
											
											// here is actually the problem. when we have created a new marker, 
											// we need to update it to database, not only update the file path
											var firstData = {"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[geoJsonPoint.geometry.coordinates]}}]}
												
											$.get("api/resource/"+docTypeName+"/"+row, function(data, status){
												var custom_geolocation = data.data;
												var result = JSON.parse(custom_geolocation.frontech_custom_geolocation)
												result.features.push({
													"type": "Feature",
													"properties": {
														"filePath": '/files/'+validFileName
													},
													"geometry": {
														"type": "Point",
														"coordinates": geoJsonPoint.geometry.coordinates
													}
												});
												frappe.call({
													url: '/api/resource/'+docTypeName+ '/' + row,
													type: "PUT",
													args: {
														data: {"frontech_custom_geolocation": JSON.stringify(result)}
													},
													callback: function(r) {
														console.log(JSON.stringify(r));
														frappe.show_alert({
															message:__('Uploaded. This page is going to reload after 5 seconds'),
															indicator:'green'
														}, 5);
														setTimeout(function(){ location.reload(true); }, 5000);
													}
												});
											});
										}else{
											frappe.throw(__('Please upload a file first!'));
										}
										
									});
									return L.marker(latlng).bindPopup(myPopup);
								}
								
									
							}else{
								frappe.throw(__('Please Save it first!'));
								return
							}
						}
					}
				}));
			this.add_non_group_layers(data_layers, this.editableLayers);
			try {

				// This is where to stop zoom out the Bounds
				// this.map.flyToBounds(this.editableLayers.getBounds(), {
				// 	padding: [50,50]
				// });
			}
			catch(err) {
				// suppress error if layer has a point.
			}
			this.editableLayers.addTo(this.map);
			this.map._onResize();
		} else if ((value===undefined) || (value == JSON.stringify(new L.FeatureGroup().toGeoJSON()))) {
			this.locate_control.start();
		}
	},

	bind_leaflet_map() {
		var circleToGeoJSON = L.Circle.prototype.toGeoJSON;
		L.Circle.include({
			toGeoJSON: function() {
				var feature = circleToGeoJSON.call(this);
				feature.properties = {
					point_type: 'circle',
					radius: this.getRadius()
				};
				return feature;
			}
		});

		L.CircleMarker.include({
			toGeoJSON: function() {
				var feature = circleToGeoJSON.call(this);
				feature.properties = {
					point_type: 'circlemarker',
					radius: this.getRadius()
				};
				return feature;
			}
		});

		L.Icon.Default.imagePath = '/assets/frappe/images/leaflet/';

		this.map = L.map(this.map_id).setView([53.447410,-113.470610], 13);

		L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(this.map);
	},

	bind_leaflet_locate_control() {
		// To request location update and set location, sets current geolocation on load
		this.locate_control = L.control.locate({position:'topright'});
		this.locate_control.addTo(this.map);
	},

	bind_leaflet_draw_control() {
		this.editableLayers = new L.FeatureGroup();

		var options = {
			position: 'topleft',
			draw: {
				polyline: {
					shapeOptions: {
						color: frappe.ui.color.get('blue'),
						weight: 10
					}
				},
				polygon: {
					allowIntersection: false, // Restricts shapes to simple polygons
					drawError: {
						color: frappe.ui.color.get('orange'), // Color the shape will turn when intersects
						message: '<strong>Oh snap!<strong> you can\'t draw that!' // Message that will show when intersect
					},
					shapeOptions: {
						color: frappe.ui.color.get('blue')
					}
				},
				circle: true,
				rectangle: {
					shapeOptions: {
						clickable: false
					}
				}
			},
			edit: {
				featureGroup: this.editableLayers, //REQUIRED!!
				remove: true
			}
		};

		// create control and add to map
		var drawControl = new L.Control.Draw(options);

		this.map.addControl(drawControl);

		this.map.on('draw:created', (e) => {
			var type = e.layerType,
				layer = e.layer;
			if (type === 'marker') {
				layer.bindPopup('Marker');
			}
			this.editableLayers.addLayer(layer);
			this.set_value(JSON.stringify(this.editableLayers.toGeoJSON()));
		});

		this.map.on('draw:deleted draw:edited', (e) => {
			var layer = e.layer;
			this.editableLayers.removeLayer(layer);
			this.set_value(JSON.stringify(this.editableLayers.toGeoJSON()));
		});
	},

	bind_leaflet_refresh_button() {
		L.easyButton({
			id: 'refresh-map-'+this.df.fieldname,
			position: 'topright',
			type: 'replace',
			leafletClasses: true,
			states:[{
				stateName: 'refresh-map',
				onClick: function(button, map){
					map._onResize();
				},
				title: 'Refresh map',
				icon: 'fa fa-refresh'
			}]
		}).addTo(this.map);
	},

	add_non_group_layers(source_layer, target_group) {
		// https://gis.stackexchange.com/a/203773
		// Would benefit from https://github.com/Leaflet/Leaflet/issues/4461
		if (source_layer instanceof L.LayerGroup) {
			source_layer.eachLayer((layer)=>{
				this.add_non_group_layers(layer, target_group);
			});
		} else {
			target_group.addLayer(source_layer);
		}
	},

	clear_editable_layers() {
		console.log('I am here clear_editable_layers');
		this.editableLayers.eachLayer((l)=>{
			this.editableLayers.removeLayer(l);
		});
	},
	doesFileExist: function(urlToFile) {
		// console.log('I am here file does exist');
		var xhr = new XMLHttpRequest();
		xhr.open('HEAD', urlToFile, false);
		xhr.send();
		console.log(xhr.status);
		
		if (xhr.status == "404" || xhr.status == "500") {
			console.log('Not found');
			return false;
		} else {
			console.log('found');
			return true;
		}
	},

	getValidFileName: function(fileName){
		var currentTime = new Date().toJSON().replaceAll(':', "-").slice(0,19);
		var newfileName = currentTime + new Date().getMilliseconds().toString() + fileName
		var fileExists = this.doesFileExist('/files/'+newfileName);
		
		while (fileExists){
			currentTime = new Date().toJSON().replaceAll(':', "-").slice(0,19);
			newfileName = currentTime + new Date().getMilliseconds().toString() + fileName; 
			fileExists = this.doesFileExist('/files/'+newfileName);
		}

		return newfileName
	}
	

	// InitThis() {
	// 	console.log('Init This');
	// 	ctx = document.getElementById('myCanvas').getContext("2d");

	// 	$('#myCanvas').mousedown(function (e) {
	// 		mousePressed = true;
	// 		Draw(e.pageX - $(this).offset().left, e.pageY - $(this).offset().top, false);
	// 	});

	// 	$('#myCanvas').mousemove(function (e) {
	// 		if (mousePressed) {
	// 			Draw(e.pageX - $(this).offset().left, e.pageY - $(this).offset().top, true);
	// 		}
	// 	});

	// 	$('#myCanvas').mouseup(function (e) {
	// 		mousePressed = false;
	// 	});
	// 		$('#myCanvas').mouseleave(function (e) {
	// 		mousePressed = false;
	// 	});
	// },

	// Draw() {
	// 	console.log('Draw');
	// 	if (isDown) {
	// 		ctx.beginPath();
	// 		ctx.strokeStyle = $('#selColor').val();
	// 		ctx.lineWidth = $('#selWidth').val();
	// 		ctx.lineJoin = "round";
	// 		ctx.moveTo(lastX, lastY);
	// 		ctx.lineTo(x, y);
	// 		ctx.closePath();
	// 		ctx.stroke();
	// 	}
	// 	lastX = x; lastY = y;
	// },	
		
	// clearArea() {
	// 	console.log('clearArea');
	// 	// Use the identity matrix while clearing the canvas
	// 	ctx.setTransform(1, 0, 0, 1, 0, 0);
	// 	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	// }
});
