# TokenAPI

This repo contains a simple Node JS wrapper for some Akamai token functions.

{
    "server": {
        "port": 3001
    },
    "akamaiAuth": {
        "clientToken": "Your client token",
        "clientSecret": "Your client secret",
        "accessToken": "Your access token",
        "baseUri": "Your base URL"
    },
    "akamaiEdgeRC": {
        "basePath":"/taas/v2/revocation-lists/Your list ID/identifiers"
    },
    "token": {
        "key": "Your token generation private key"
    }
}
