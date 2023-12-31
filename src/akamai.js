//This app embed a number of functions needed for antipiracy
//author anasman@akamai.com 2023

const loglevel = 'debug';
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
const crypto = require('crypto');
const EdgeAuth = require('akamai-edgeauth');
var EdgeGrid = require('akamai-edgegrid');
const config = require("config");
const { Client } = require('@elastic/elasticsearch');
var EdgeGrid = require('akamai-edgegrid');
   
var eg = new EdgeGrid(config.get("akamaiAuth.clientToken"), config.get("akamaiAuth.clientSecret"), config.get("akamaiAuth.accessToken"), config.get("akamaiAuth.baseUri"));

const JWT_KEY = config.get("interfaceaccesstoken.key")


// Define the encryption details
const algorithm = 'aes-256-cbc';
const secret = '1111111111your-shared-secret-key';  // This must be 256 bits (32 characters)
const ivLength = 16;  // For AES, this is always 16


const esclient = new Client({
  node: config.get("elasticdb.url")
});


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

function encrypt(text) {
	let iv = crypto.randomBytes(ivLength);
	let cipher = crypto.createCipheriv(algorithm, Buffer.from(secret), iv);
	let encrypted = cipher.update(text);
	
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	
	// iv needed for decryption, so we will concatenate with encrypted message
	return iv.toString('hex') + ':' + encrypted.toString('hex');
	}
	
function decrypt(text) {
	let textParts = text.split(':');
	let iv = Buffer.from(textParts.shift(), 'hex');
	let encryptedText = Buffer.from(textParts.join(':'), 'hex');
	let decipher = crypto.createDecipheriv(algorithm, Buffer.from(secret), iv);
	let decrypted = decipher.update(encryptedText);
	
	decrypted = Buffer.concat([decrypted, decipher.final()]);
	
	return decrypted.toString();
	}
	  
	function getUniqueSidsForHmac(hmac) {
		return client.search({
		  index: 'antipiracy', // replace with your index name
		  body: {
			size: 0,
			query: {
			  term: {
				hmac: hmac // this will filter documents that have the specific hmac
			  }
			},
			aggs: {
			  unique_sids: {
				terms: {
				  field: 'sid.keyword', // this will group documents by sid
				  size: 1000 // adjust this number based on your needs
				}
			  }
			}
		  }
		})
		.then(response => {
			console.log('Elasticsearch response:', JSON.stringify(response.body));
			// extract and return the unique sids from the response
			return response.body.aggregations.unique_sids.buckets.map(bucket => bucket.key);
		  })
		.catch(error => {
		  console.error('Elasticsearch query failed:', error);
		});
	  }

	async function storeSession(sid,fraud) {
		console.log("Saving: "+sid);
		try {
			
			const response = await esclient.reindex({
				body: {
					source: {
						index: 'antipiracy',
						query: {
							term: {
								'sid.keyword': sid.toString()
							}
						}
					},
					dest: {
						index: 'storedsessions'
					},
					script: {
						source: 'ctx._source.fraud = params.fraud',  // Use params.fraud here
						params: {
							fraud: fraud  // Assign your dynamic value to the fraud parameter
						}
					}
				}
			});
		
			console.log('Reindex operation response:', response.body);
		} catch (error) {
			console.log('Error during reindexing:'+error,'error');
		}
	}

	async function deleteBySid(sid) {
		try {
			const response = await esclient.deleteByQuery({
				index: 'storedsessions',  // replace with your actual index name
				body: {
					query: {
						term: {
							'sid.keyword': sid.toString()
						}
					}
				}
			});
	
			console.log('Delete operation response:', response.body);
		} catch (error) {
			console.error('Error during deletion:', error);
		}
	}

	function verifyIP(req, res, next) {
		const clientIp = req.connection.remoteAddress || req.headers['x-forwarded-for'];
	
		log('IP check: '+clientIp);

		if (clientIp === '127.0.0.1' || clientIp === '::1') {
			next();
		} else {
			log('IP Access denied');
			res.status(403).send('Access denied from IP: ' + clientIp);
		}
	}
	
	function verifyToken(req, res, next) {
		const jwttoken = req.query.jwttoken; // Assuming token is passed as a query parameter.
	
		if (!jwttoken) {
			log('No JWT Token Access denied');
			return res.status(401).json({ message: "No token provided." });
		}
	
		jwt.verify(jwttoken, JWT_KEY, (err, decoded) => {
			if (err) {
				log('JWT Token Access denied');
				return res.status(401).json({ message: "Invalid or expired token." });
			}
	
			// Optionally, you can attach the decoded payload to the request object.
			req.decoded = decoded;
	
			next(); // If token is valid, continue processing the request.
		});
	}

//Catch all requests and log them
app.use(express.json());


//Catch all and log
app.use((req, res, next) => {
		log(req.method+' '+req.url+' '+JSON.stringify(req.query)+' '+JSON.stringify(req.body));
		next();
	});

//API methods
app.get('/test', verifyToken, (req, res) => {
	log('test');
	res.status(200).json('ok');
});

app.get('/styles.css', (req, res) => {
    res.type('text/css');
    res.send(`
	body {
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		background-color: #f7f8fa;
		margin: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
	}

	.centered-box {
		background-color: white;
		padding: 20px;
		border: 1px solid #e0e4e7;
		box-shadow: 0 0 10px rgba(0,0,0,0.1);
		border-radius: 3px;
	}

	.warning-text {
		color: #d44950;
		margin-bottom: 20px;
	}

	button {
		padding: 10px 15px;
		border: none;
		border-radius: 4px;
		font-weight: 500;
		margin-right: 10px;
		cursor: pointer;
	}

	button:last-child {
		margin-right: 0;
	}

	button:focus {
		outline: none;
	}

	.btn-primary {
		background-color: #299c46;
		color: white;
	}

	.btn-secondary {
		background-color: #3274d9;
		color: white;
	}
	`);
});

app.get('/storeSessionGui', verifyToken, (req, res) => {
    const id = req.query.id;
    const fraud = req.query.fraud;
	const jwttoken = req.query.jwttoken;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Store session</title>
    		<link rel="stylesheet" type="text/css" href="./styles.css">
		</head>
        <body>
		<div class="centered-box">
			<div class="warning-text">
				Do you intend to store session ${id} with fraud=${fraud}?
			</div>
			<button class="btn-primary" onclick="storeAndClose()">OK</button>
			<button class="btn-secondary" onclick="closeTab()">Cancel</button>
		</div>

            <script>
                async function storeAndClose() {
                    try {
                        // Make the API call
                        const response = await fetch('./storeSession?id=${id}&fraud=${fraud}&jwttoken=${jwttoken}');
                        if (response.ok) {
                            console.log('API call successful');
                        } else {
                            console.error('API call failed with status', response.status);
                        }
                    } catch (error) {
                        console.error('Error making API call', error);
                    } finally {
                        window.close(); // Close the tab after the API call, regardless of success or failure
                    }
                }

				function closeTab() {
                    window.close();
                }

            </script>
        </body>
        </html>
    `);
});

app.get('/deleteStoredSessionGui', verifyToken, (req, res) => {
    const id = req.query.id;
    const fraud = req.query.fraud;
	const jwttoken = req.query.jwttoken;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Delete stored session</title>
			<link rel="stylesheet" type="text/css" href="./styles.css">
        </head>
        <body>
			<div class="centered-box">
				<div class="warning-text">
					Do you intend to delete stored session ${id}?
				</div>
				<button class="btn-primary" onclick="storeAndClose()">OK</button>
				<button class="btn-secondary" onclick="closeTab()">Cancel</button>
			</div>

            <script>
                async function storeAndClose() {
                    try {
                        // Make the API call
                        const response = await fetch('./deleteStoredSession?id=${id}&jwttoken=${jwttoken}');
                        if (response.ok) {
                            console.log('API call successful');
                        } else {
                            console.error('API call failed with status', response.status);
                        }
                    } catch (error) {
                        console.error('Error making API call', error);
                    } finally {
                        window.close(); // Close the tab after the API call, regardless of success or failure
                    }
                }

                function closeTab() {
                    window.close();
                }

            </script>
        </body>
        </html>
    `);
});

app.get('/blockTokenGui', verifyToken, (req, res) => {
    const id = req.query.id;
    const fraud = req.query.fraud;
	const jwttoken = req.query.jwttoken;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Block token</title>
			<link rel="stylesheet" type="text/css" href="./styles.css">
        </head>
        <body>
			<div class="centered-box">
				<div class="warning-text">
					Do you intend to block token ${id}?
				</div>
				<button class="btn-primary" onclick="storeAndClose()">OK</button>
				<button class="btn-secondary" onclick="closeTab()">Cancel</button>
			</div>

            <script>
				async function storeAndClose() {
					try {
						// First API call to ./blockToken
						let response = await fetch(\`./blockToken?id=${id}&jwttoken=${jwttoken}\`);
						if (response.ok) {
							console.log('First API call (blockToken) successful');
						} else {
							console.error(\`First API call (blockToken) failed with status \${response.status}\`);
						}

						// Second API call to ./storeSession
						response = await fetch(\`./storeSession?id=${id}&fraud=true&jwttoken=${jwttoken}\`);
						if (response.ok) {
							console.log('Second API call (storeSession) successful');
						} else {
							console.error(\`Second API call (storeSession) failed with status \${response.status}\`);
						}

					} catch (error) {
						console.error(\`Error making API call \${error}\`);
					} finally {
						window.close(); // Close the tab after both API calls, regardless of success or failure
					}
				}

                function closeTab() {
                    window.close();
                }

            </script>
        </body>
        </html>
    `);
});

app.get('/unblockTokenGui', verifyToken, (req, res) => {
    const id = req.query.id;
    const fraud = req.query.fraud;
	const jwttoken = req.query.jwttoken;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Unblock token</title>
			<link rel="stylesheet" type="text/css" href="./styles.css">
        </head>
        <body>
			<div class="centered-box">
				<div class="warning-text">
					Do you intend to unblock token ${id}?
				</div>
				<button class="btn-primary" onclick="storeAndClose()">OK</button>
				<button class="btn-secondary" onclick="closeTab()">Cancel</button>
			</div>

            <script>
            async function storeAndClose() {
                try {
                    // First API call to ./unblockToken
                    let response = await fetch(\`./unblockToken?id=${id}&jwttoken=${jwttoken}\`);
                    if (response.ok) {
                        console.log('First API call (unblockToken) successful');
                    } else {
                        console.error(\`First API call (unblockToken) failed with status \${response.status}\`);
                    }

                    // Second API call to ./deleteStoredSession
                    response = await fetch(\`./deleteStoredSession?id=${id}&jwttoken=${jwttoken}\`);
                    if (response.ok) {
                        console.log('Second API call (deleteStoredSession) successful');
                    } else {
                        console.error(\`Second API call (deleteStoredSession) failed with status \${response.status}\`);
                    }

                } catch (error) {
                    console.error(\`Error making API call \${error}\`);
                } finally {
                    window.close(); // Close the tab after both API calls, regardless of success or failure
                }
            }

			function closeTab() {
				window.close();
			}

            </script>

        </body>
        </html>
    `);
});

app.get('/createToken', verifyToken, (req, res) => {
	log('createToken');
	if (req.query.auth == "_Akama1zedT0ken_")
	{
		var ea = new EdgeAuth({key: config.get("token.key"), windowSeconds: 5000, escapeEarly: true, verbose: false});
		var token = ea.generateACLToken("/*");
		const data = {
			token: token
			};
		res.status(200).json(data);	
	} else res.status(404).send('{"status":"access denied"}');
});

app.get('/blockToken', verifyToken, (req, res) => {
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
  
app.get('/storeSession', verifyToken, (req, res) => {
    log('storeSession ' + req.query.id);

    const isFraud = req.query.fraud === 'true';

    if (req.query.id && req.query.id !== "" && 'fraud' in req.query && req.query.fraud !== "") {
        storeSession(req.query.id, isFraud);
        res.status(200).json({ status: "ok" });
    } else {
        if (!req.query.id || req.query.id === "") {
            res.status(404).json({ status: "error missing id" });
        } else if (!('fraud' in req.query) || req.query.fraud === "") {
            res.status(400).json({ status: "error missing or empty fraud parameter" });
        }
    }
});

app.get('/deleteStoredSession', verifyToken, (req, res) => {
    log('deleteSession ' + req.query.id);

    const isFraud = req.query.fraud === 'true';

    if (req.query.id && req.query.id !== "") {
        deleteBySid(req.query.id);
        res.status(200).json({ status: "ok" });
    } else {
        if (!req.query.id || req.query.id === "") {
            res.status(404).json({ status: "error missing id" });
        } 
    }
});

app.get('/unblockToken', verifyToken, (req, res) => {
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


app.get('/blockList/listSessionIDs', (req, res) => {

	const hmac = req.query.hmac;
	log('listSesstionIDs (hmac: '+hmac+')');

	getUniqueSidsForHmac(hmac) 
	.then(uniqueSids => console.log('Unique SIDs:', uniqueSids))
	.catch(error => console.error('Failed to get unique SIDs:', error));

/*
	let message = 'Hello, World!';
	let encryptedMessage = encrypt(message);

	console.log('Original Message: ' + message);
	console.log('Encrypted Message: ' + encryptedMessage);
	console.log('Decrypted Message: ' + decrypt(encryptedMessage));
	
	res.status(200).send("ok");*/
});

app.get('/generateToken', verifyIP, (req, res) => {
    log('generateToken');
	const token = jwt.sign({ timestamp: Date.now() }, JWT_KEY, { expiresIn: '15m' });
	res.status(200).json({"listItems": [{"jwttoken": token}]});

});

app.get('/redirect', (req, res) => {
	const sid = req.query['var-sid'];
	if (sid) {
		// Split the sid by hyphen and take the first part
		const newSid = sid.split('-')[0];
		// Construct the new URL
		const newURL = config.get("redirect.baseURL")+`?var-sid=${newSid}&orgId=${req.query.orgId}}`;
		// Redirect to the new URL
		res.redirect (newURL);
	}
});


app.get('/blockList/listTokens', (req, res) => {
	log('Query');
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
		let bodyobj = JSON.parse(body);
		let object = { "listItems": bodyobj};
		log (JSON.stringify(object));

		res.status(200).json(object);
	});	
});

// Define a catch-all middleware function that sends a 404 error response
app.use((req, res, next) => {
	res.status(404).send('Not found');
	});

app.listen(config.get("server.port"), () => {
	log('Express Listening on port '+config.get("server.port"));
	});

log ('Surf to: http://localhost:',config.get("server.port"),'/[function]','info');