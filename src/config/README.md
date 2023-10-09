You need to set your configuration details in the default.json file, like so: 
{
    "server": {
        "port": 3001
    },
    "akamaiAuth": {
        "clientToken": "akab-YourClientToken",
        "clientSecret": "YourClientSecret",
        "accessToken": "akab-YourAccessToken",
        "baseUri": "YourBaseURI/"
    },
    "akamaiEdgeRC": {
        "basePath":"RevocationListBasePath"
    },
    "token": {
        "key": "TokenPrivateKey"
    },
    "elasticdb": {
        "url": "http://hostname:9200"
    }
}