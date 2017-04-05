$(function() {
	var form = $('#form_input');

	var progress_bar = $('#progress_bar');

	var geo_mask = "S0D.0000 N, S0DD.0000 W";
	var pattern = {
		translation: {
			'S': { // sign
				pattern: /\-?/
			},
			'D': { // optional digit
				pattern: /\d/,
				optional: true
			}
		}
	};

	// Converts from degrees to radians.
	Math.radians = function(degrees) {
		return degrees * Math.PI / 180;
	};
	 
	// Converts from radians to degrees.
	Math.degrees = function(radians) {
		return radians * 180 / Math.PI;
	};

	var source_position_input = $('#starting_position');
	source_position_input.mask(geo_mask, pattern);
	
	var source_asl = $('#starting_asl');
	source_asl.mask('0DDDm', pattern);

	var target_position_input = $('#target_position');
	target_position_input.mask(geo_mask, pattern);

	var target_asl = $('#starting_asl');
	target_asl.mask('0DDDm', pattern);

	var preset_input = $('#body_select');

	var heading_output = $('#heading_output');
	var pitch_output = $('#pitch_output');
	var deltav_output = $('#deltav_output');

	var presets = {
		// {GM: Universal gravity in m3/s2, R: radius in m}
		bop:    {GM: 2.49e9,  R: 6.5e4,  t: 0},
		dres:   {GM: 2.15e10, R: 1.38e5, t: 0},
		duna:   {GM: 3.01e11, R: 3.2e5,  t: 0},
		eeloo:  {GM: 7.44e10, R: 2.1e5,  t: 0},
		eve:    {GM: 8.17e12, R: 7e5,    t: 0},
		gilly:  {GM: 8.29e6,  R: 1.3e4,  t: 0},
		ike:    {GM: 1.85e10, R: 1.3e5,  t: 0},
		jool:   {GM: 2.83e14, R: 6e6,    t: 0},
		kerbin: {GM: 3.53e12, R: 6e5,    t: 0},
		laythe: {GM: 1.96e12, R: 5e5,    t: 0},
		minmus: {GM: 1.76e9,  R: 6e4,    t: 0},
		moho:   {GM: 1.68e11, R: 2.5e5,  t: 0},
		mun:    {GM: 6.51e10, R: 2e5,    t: 0},
		pol:    {GM: 7.22e8,  R: 4.4e4,  t: 0},
		tylo:   {GM: 2.83e12, R: 6e5,    t: 0},
		vall:   {GM: 2.07e11, R: 3e5,    t: 0},
	};

	var geo_regex = /(\-?\d+\.\d+) N, (\-?\d+\.\d+) W/;

	function get_coordinates(input){
		var start = input.val();
		var match = geo_regex.exec(start);

		if (!match){
			set_error(input.parent(), true);
			return null;
		} else {
			set_error(input.parent(), false);
		}

		console.log("match: "+match[1]+", "+match[2]);
		
		return {
			lat: match[1],
			lon: match[2]
		};
	}

	function calculate(start, end, body){
		function calculate_bearing(lat_1, lon_1, lat_2, lon_2){
			return Math.atan2(
				Math.cos(lat_1)*Math.sin(lat_2) - Math.sin(lat_1)*Math.cos(lat_2)*Math.cos(lon_2 - lon_1),
				Math.sin(lon_2 - lon_1)*Math.cos(lat_2)
			);
		}

		function calculate_theta(lat_1, lon_1, lat_2, lon_2){
			return Math.acos(
				Math.cos(lat_1)*Math.cos(lon_1)*Math.cos(lat_2)*Math.cos(lon_2)
					+ Math.cos(lat_1)*Math.sin(lon_1)*Math.cos(lat_2)*Math.sin(lon_2)
					+ Math.sin(lat_1)*Math.sin(lat_2)
			);
		}

		function get_vector_mr(mag, radians){
			return {
				x: mag * Math.cos(radians),
				y: mag * Math.sin(radians),
				mag: mag
			};
		}

		function get_vector_xy(x, y){
			return {
				x: x,
				y: y,
				mag: Math.sqrt(x*x + y*y)
			};
		}

		function log_vector(label, vector){
			console.log(" "+label+":  [ x:"+vector.x.toFixed(2)+"m, y:"+vector.y.toFixed(2)+"m]");
			console.log("|"+label+"|: "+vector.mag.toFixed(2)+"m");
		}

		function log_orbit(label, orbit){
			console.log(label+": a:"+orbit.a.toFixed(2) +"m, c:"+orbit.c.toFixed(2) +"m, e:"+orbit.e.toFixed(2) +", ap:"+orbit.ap.toFixed(2)+"m");
			console.log(label+" period: "+orbit.t+"s");
		}
		
		var heading = Math.degrees(calculate_bearing(start.lat, start.lon, end.lat, end.lon));
		console.log("Heading: "+heading.toFixed(4)+"d");
		set_heading(heading);
		
		var theta = calculate_theta(start.lat, start.lon, end.lat, end.lon);
		console.log("Theta: "+theta.toFixed(4)+"r");

		var min_mag = Math.min(start.asl + body.R, end.asl + body.R);
		var Ra = get_vector_mr(min_mag, theta);
		log_vector('Ra', Ra);

		var max_mag = Math.max(start.asl + body.R, end.asl + body.R);
		//var Rb = get_vector_mr(max_mag, theta);
		var Rb = get_vector_xy(200000, 0); // Note: This is hard coded in the excel sheet for some reason.
		log_vector('Rb', Rb);

		var Rc = get_vector_xy(Rb.x - Ra.x, Rb.y - Ra.y);
		log_vector('Rc', Rc);

		var Rf = get_vector_xy(
			Rb.x - 0.5*(Rc.x/Rc.mag)*(Rc.mag - Rb.mag + Ra.mag), // x
			Rb.y - 0.5*(Rc.y/Rc.mag)*(Rc.mag - Rb.mag + Ra.mag) // y
		);
		log_vector('Rf', Rf);

		var orbit = {
			a:  0.5 * (Rb.mag + 0.5*(Rc.mag - Rb.mag + Ra.mag)),
			c:  Rf.mag / 2
		};

		orbit.e = orbit.c / orbit.a;
		orbit.ap = orbit.a * (1 + orbit.e);
		orbit.t = 6.28318 * Math.sqrt(orbit.a*orbit.a*orbit.a / body.GM);
		log_orbit('Optimal Orbit', orbit);
	}

	function set_error(which, is_error){ // which = jquery element, is_error = true/false
		if (is_error){
			which.addClass('has-error').removeClass('has-success');
		} else {
			which.addClass('has-success').removeClass('has-error');
		}
	}

	function set_progress(complete){
		progress_bar.width(complete);
	}

	function set_heading(heading){
		while (heading < 0){
			heading += 360;
		}
		heading_output.val(heading.toFixed(1) + "° east from North");
	}

	function set_pitch(pitch){
		pitch_output.val(pitch.toFixed(1) + "° above the horizon");
	}

	// testing
	set_error(target_position_input, true);
	set_progress('57%');

	var body = presets.gilly;
	var start = get_coordinates(source_position_input);
	start.asl = 0;

	var end = get_coordinates(target_position_input);
	end.asl = 0;

	calculate(start, end, body);
	set_pitch(47);
});