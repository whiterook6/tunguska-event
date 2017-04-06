// https://docs.google.com/spreadsheets/d/1JIUHIAujZuQdvPRIo-FTho82QcEqVLeuRe-lLiM_b-I/edit

// Converts from degrees to radians.
Math.radians = function(degrees) {
	return degrees * Math.PI / 180;
};
 
// Converts from radians to degrees.
Math.degrees = function(radians) {
	return radians * 180 / Math.PI;
};

$(function() {

	// form elements
	var form = $('#form_input');

	var source_position_input = $('#starting_position');
	var source_asl_input = $('#starting_asl');
	var target_position_input = $('#target_position');
	var target_asl_input = $('#target_asl');
	var preset_input = $('#body_select');
	
	var submit_button = $('#submit');
	var reset_button = $('#reset');
	var progress_bar = $('#progress_bar');

	var heading_output = $('#heading_output');
	var pitch_output = $('#pitch_output');
	var deltav_output = $('#deltav_output');

	// static data
	var presets = {
		// {GM: Universal gravity in m3/s2, R: radius in m, t: orbital period in s}
		bop:    {GM: 2.49e9,  R: 6.5e4,  t: 544507.43},
		dres:   {GM: 2.15e10, R: 1.38e5, t: 34800},
		duna:   {GM: 3.01e11, R: 3.2e5,  t: 65517.859},
		eeloo:  {GM: 7.44e10, R: 2.1e5,  t: 19460},
		eve:    {GM: 8.17e12, R: 7e5,    t: 80500},
		gilly:  {GM: 8.29e6,  R: 1.3e4,  t: 28255},
		ike:    {GM: 1.85e10, R: 1.3e5,  t: 65517.862},
		jool:   {GM: 2.83e14, R: 6e6,    t: 36000},
		kerbin: {GM: 3.53e12, R: 6e5,    t: 21549.425},
		laythe: {GM: 1.96e12, R: 5e5,    t: 52980.879},
		minmus: {GM: 1.76e9,  R: 6e4,    t: 40400},
		moho:   {GM: 1.68e11, R: 2.5e5,  t: 1210000},
		mun:    {GM: 6.51e10, R: 2e5,    t: 138984.38},
		pol:    {GM: 7.22e8,  R: 4.4e4,  t: 901902.62},
		tylo:   {GM: 2.83e12, R: 6e5,    t: 211926.36},
		vall:   {GM: 2.07e11, R: 3e5,    t: 105962.09},
	};

	// logging
	function log_vector(label, vector){
		console.log(" "+label+":  [ x:"+vector.x.toFixed(2)+"m, y:"+vector.y.toFixed(2)+"m]");
		console.log("|"+label+"|: "+vector.mag.toFixed(2)+"m");
	}

	function log_orbit(label, orbit){
		console.log(label+": a:"+orbit.a.toFixed(2) +"m, c:"+orbit.c.toFixed(2) +"m, e:"+orbit.e.toFixed(2) +", ap:"+orbit.ap.toFixed(2)+"m");
		console.log(label+" period: "+orbit.t+"s");
	}

	function log_coordinates(label, coordinates){
		console.log(label+": lat: "+Math.degrees(coordinates.lat)+" lon: "+Math.degrees(coordinates.lon)+" at "+coordinates.asl+"m from sea level.");
	}

	// reading input
	function parse_coordinates(input){
		var geo_regex = /(\-?\d+\.\d+).*N, (\-?\d+\.\d+).*W/;
		var start = input.val();
		var match = geo_regex.exec(start);
		
		return {
			lat: Math.radians(parseFloat(match[1])),
			lon: Math.radians(parseFloat(match[2]))
		};
	}

	function parse_asl(input){
		var asl_regex = /(\-?\d+\.?\d*)m/;
		var asl = input.val();
		var match = asl_regex.exec(asl);

		return parseFloat(match[1]);
	}

	// calculations ... urgh
	function calculate_bearing(lat_1, lon_1, lat_2, lon_2){
		return Math.atan2(
			Math.cos(lat_1)*Math.sin(lat_2) - Math.sin(lat_1)*Math.cos(lat_2)*Math.cos(lon_2 - lon_1),
			Math.sin(lon_2 - lon_1)*Math.cos(lat_2)
		);
	}

	function calculate_heading(start, end){
		var heading = Math.degrees(calculate_bearing(start.lat, start.lon, end.lat, end.lon));
		return heading;
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

	function calculate_optimal_orbit(start, end, body){
		var theta = calculate_theta(start.lat, start.lon, end.lat, end.lon);
		console.log("B9 (Theta): "+theta.toFixed(4)+"r");

		var min_mag = Math.min(start.asl + body.R, end.asl + body.R);
		var Ra = get_vector_mr(min_mag, theta);
		log_vector('Ra', Ra);

		var max_mag = Math.max(start.asl + body.R, end.asl + body.R);
		var Rb = get_vector_xy(max_mag, 0); // manually set to find the x-origin or some shit
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
			c:  Rf.mag / 2,
			Ra: Ra,
			Rb: Rb,
			Rc: Rc,
			Rf: Rf,
			theta: theta,
		};

		orbit.e = orbit.c / orbit.a;
		orbit.ap = orbit.a * (1 + orbit.e);
		orbit.t = 6.28318 * Math.sqrt(orbit.a*orbit.a*orbit.a / body.GM);

		return orbit;
	}

	function calculate_deltav(orbit, start, end, body){
		var altitude_1 = start.asl + body.R;
		var v1 = Math.sqrt(body.GM * ((2/altitude_1) - (1/orbit.a)));

		var altitude_2 = end.asl + body.R;
		var v2 = Math.sqrt(body.GM * ((2/altitude_2) - (1/orbit.a)));

		return v1 + v1;
	}

	function calculate_true_anomaly(orbit, start, end){
		if (start.asl > end.asl){
			return 3.14159 - Math.acos(
				(orbit.Rf.x*orbit.Rb.x + orbit.Rf.y*orbit.Rb.y) / (orbit.Rf.mag*orbit.Rb.mag)
			);
		} else {
			return 3.14159 - Math.acos(
				(orbit.Rf.x*orbit.Ra.x + orbit.Rf.y*orbit.Ra.y) / (orbit.Rf.mag*orbit.Ra.mag)
			);
		}
	}

	function calculate_flight_path(orbit, true_anomaly){
		return Math.atan(
			(orbit.e*Math.sin(true_anomaly)) / (1 + orbit.e*Math.cos(true_anomaly))
		);
	}


	function calculate_time_from_periapsis(orbit, true_anomaly){
		var eccentric_anomaly = Math.acos((orbit.e + Math.cos(true_anomaly)) / (1 + orbit.e*Math.cos(true_anomaly)));
		
		if (true_anomaly > 3.14159){
			eccentric_anomaly = 6.28318 - eccentric_anomaly;
		}

		var mean_anomaly = eccentric_anomaly - orbit.e * Math.sin(eccentric_anomaly);
		return mean_anomaly * orbit.t / 6.28318;
	}

	function calculate_flight_time(time_at_launch, time_at_landing, orbit){
		if (time_at_launch < time_at_landing){
			return time_at_landing - time_at_launch;
		} else {
			return time_at_landing - time_at_launch + orbit.t;
		}
	}

	function calculate_body_rotation(body, t){ // returns in radians
		return (t / body.t) * 6.28318;
	}

	function calculate_pitch(orbit, true_anomaly){
		return Math.atan(orbit.e * true_anomaly / (1 + orbit.e*true_anomaly));
	}

	function run_calculations(){
		var heading;
		var pitch;
		var deltav;

		var body = presets[preset_input.val()];
		var start = parse_coordinates(source_position_input);
		start.asl = parse_asl(source_asl_input);

		var end = parse_coordinates(target_position_input);
		end.asl = parse_asl(target_asl_input);

		var new_end = {
			lat: end.lat,
			lon: end.lon,
			asl: end.asl
		};

		var orbit = calculate_optimal_orbit(start, new_end, body);
		log_orbit('Initial Orbit', orbit);

		for (var i = 0; i < 5; i++) {

			// calculate how far the target travels over time and compensate
			var true_anomaly = calculate_true_anomaly(orbit, start, new_end);
			var time_at_launch = calculate_time_from_periapsis(orbit, true_anomaly);
			var time_at_landing = calculate_time_from_periapsis(orbit, true_anomaly + orbit.theta);
			var flight_time = calculate_flight_time(time_at_launch, time_at_landing, orbit);
			console.log('Flight time: '+flight_time+'s');
			var rotation = calculate_body_rotation(body, flight_time);

			new_end.lon = end.lon + rotation;
			log_coordinates('New end', new_end);
			orbit = calculate_optimal_orbit(start, new_end, body);
		}

		log_orbit('Final Orbit', orbit);
		set_heading(calculate_heading(start, new_end));

		set_pitch(calculate_pitch(orbit, calculate_true_anomaly(orbit, start, new_end)));
		set_deltav(calculate_deltav(orbit, start, new_end, body));
	}

	function set_progress(complete){
		progress_bar.width(complete);
	}

	function set_heading(heading){
		while (heading < 0){
			heading += 360;
		}

		var suffix;
		if (heading < 22.5 || heading > 337.5){
			suffix = "° (mostly north)";
		} else if (heading < 67.5){
			suffix = "° (mostly northeast)";
		} else if (heading < 112.5){
			suffix = "° (mostly east)";
		} else if (heading < 157.5){
			suffix = "° (mostly southeast)";
		} else if (heading < 202.5){
			suffix = "° (mostly south)";
		} else if (heading < 247.5){
			suffix = "° (mostly southwest)";
		} else if (heading < 292.5){
			suffix = "° (mostly west)";
		} else {
			suffix = "° (mostly northwest)";
		}

		heading_output.val(heading.toFixed(1) + suffix);
	}

	function set_pitch(pitch){
		pitch_output.val(Math.degrees(pitch).toFixed(1) + "° above the horizon");
	}

	function set_deltav(deltav){
		if (deltav < 900){
			deltav_output.val(deltav.toFixed(2)+"m/s");
		} else {
			deltav_output.val((deltav/1000).toFixed(3)+"km/s");
		}
	}

	// controls
	submit_button.click(run_calculations);
});
