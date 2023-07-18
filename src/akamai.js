//This app embed a number of functions needed for antipiracy
//author anasman@akamai.com 2023

const loglevel = 'debug';
const express = require('express');
const app = express();
const cors = require('cors');
const EdgeAuth = require('akamai-edgeauth');
var EdgeGrid = require('akamai-edgegrid');
const config = require("config");
   
var eg = new EdgeGrid(config.get("akamaiAuth.clientToken"), config.get("akamaiAuth.clientSecret"), config.get("akamaiAuth.accessToken"), config.get("akamaiAuth.baseUri"));
 
//Get date time
function timestamp() {
	let date_ob = new Date();
  	let date = ("0" + date_ob.getDate()).slice(-2);
  	let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
  	let year = date_ob.getFullYear();
  	let hours = date_ob.getHours();
  	let minutes = date_ob.getMinutes();
  	let seconds = date_ob.getSeconds();
  	result = +year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds;
  	return result;  		
	}

//Log data to console
function log(msg,msgtype){
	if (typeof msgtype == 'undefined') {msgtype='debug';}
	if (msgtype=='debug'){msg=timestamp()+':\x1b[32m '+msg}
	if (msgtype=='info'){msg=timestamp()+':\x1b[32m '+msg}
	if (msgtype=='error'){msg=timestamp()+':\x1b[31m '+msg}
	
	if (loglevel == 'debug'){console.log(msg);}
	if (loglevel == 'info'){
		if (msgtype == 'info'){console.info(msg);}
		if (msgtype == 'error'){console.error(msg);}}
	if (loglevel == 'error'){
		if (msgtype == 'error'){console.error(msg);}}
	}

//Catch all requests and log them
app.use((req, res, next) => {
		log(req.method+' '+req.url+' '+JSON.stringify(req.query)+' '+JSON.stringify(req.body));
		next();
	});

//API methods
app.get('/test', (req, res) => {
	log('test');
	res.status(200).json('ok');
});

app.get('/createToken', (req, res) => {
	log('createToken');
		var ea = new EdgeAuth({key: config.get("token.key"), windowSeconds: 5000, escapeEarly: true, verbose: false});
		var token = ea.generateACLToken("/*");
		const data = {
			token: token
			};
		res.status(200).json(data);	
});

app.get('/blockToken', (req, res) => {
	log('blockToken '+req.query.id);
	if ((req.query.id != "")&&(req.query.id != undefined)){
		var data = [
			{
				"durationSeconds": 18000,
				"id": req.query.id
			}
		];
		eg.auth({
			path: config.get("akamaiEdgeRC.basePath")+'/add', 
			method: 'POST',
			headers: {
			'Accept': "application/json"
			},
			qs: {
			},
			body: data
		});
		eg.send(function(error, response, body) {
			log('Error: '+error);
			log('Body: '+body);
			response=JSON.parse(body);
			res.status(200).json(response);
		});		
	} else res.status(404).send('Missing or flaw id');
});

app.get('/unblockToken', (req, res) => {
	log('unblockToken '+req.query.id);
	if ((req.query.id != "")&&(req.query.id != undefined)){
		var data = [
			req.query.id	
		];
		eg.auth({
			path: config.get("akamaiEdgeRC.basePath")+'/remove', 
			method: 'POST',
			headers: {
			'Accept': "application/json"
			},
			qs: {
			},
			body: data
		});
		eg.send(function(error, response, body) {
			log('Error: '+error);
			log('Body: '+body);
			response=JSON.parse(body);
			res.status(200).json(response);
		});		
	} else res.status(404).send('Missing or flaw id');
});

app.get('/listTokens', (req, res) => {
	eg.auth({
		path: config.get("akamaiEdgeRC.basePath"), 
		method: 'GET',
		headers: {
			'Accept': "application/json"
		}
	});
	eg.send(function(error, response, body) {
		log('Error: '+error);
		log('Body: '+body);
		response=JSON.parse(body);
		res.status(200).json(response);
	});	
});

//The following methods responds to a Grafana JSON request
app.get('/', (req, res) => {
	
	let data = { "status": "ok"};
	res.status(200).send(data);
});


app.get('/blockList/search', (req, res) => {
	
		let data = [ { "text": "blocklist", "value": 1} ];
    	res.status(200).send(data);
	});


	const getQueryData = () => {
		return [
		  {
			"target":"pps in",
			"datapoints":[
			  [622,1450754160000],
			  [365,1450754220000]
			]
		  },
		  {
			"target":"pps out",
			"datapoints":[
			  [861,1450754160000],
			  [767,1450754220000]
			]
		  },
		  {
			"target":"errors out",
			"datapoints":[
			  [861,1450754160000],
			  [767,1450754220000]
			]
		  },
		  {
			"target":"errors in",
			"datapoints":[
			  [861,1450754160000],
			  [767,1450754220000]
			]
		  }
		]
	  };

app.get('/blockList/query', (req, res) => {
	let data = getQueryData();
	res.status(200).send(data);
});

app.get('/blockList/annotations', (req, res) => {
	
	let data = [ { "text": "upper_25", "value": 1}, { "text": "upper_75", "value": 2} ];
	res.status(200).send(data);
});


// Define a catch-all middleware function that sends a 404 error response
app.use((req, res, next) => {
	res.status(404).send('Not found');
	});

app.listen(config.get("server.port"), () => {
	log('Express Listening on port '+config.get("server.port"));
	});

log ('Surf to: http://localhost:',config.get("server.port"),'/[function]','info');