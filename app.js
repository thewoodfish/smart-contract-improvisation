// imports
const express = require('express');
const app = express();
const bodyParser = require("body-parser");
const port = 4000;


//Allow express to parse json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// static files
app.use(express.static('public'));
app.use('/css', express.static(__dirname + 'public/css'));
app.use('/js', express.static(__dirname + 'public/js'));
app.use('/img', express.static(__dirname + 'public/img'));

// representing our contract storage
let SamOS = {
    auth_list: {},
    files_meta: {},
    access_list: {}
};

// handler functions simulating contract messages
function createNewAccount(did, auth_content, did_doc_cid, res) {
    let user = {
        auth_content,
        did_doc_cid
    };

    SamOS.auth_list[did] = user;

    log_contract_state()
    return res.send({
        success: true
    })
}

function accountIsAuth(did, password, is_auth, res) {
    // check if account exists
    log_contract_state()
    if (is_auth) {
        return res.send({
            is_auth: SamOS.auth_list[did] && SamOS.auth_list[did].auth_content == password
        });
    } else {
        return res.send({
            is_auth: SamOS.auth_list.hasOwnProperty(did)
        });
    }
}

function getFileSyncInfo(hk, res) {
    // get entry if any
    let meta = SamOS.files_meta[hk];
    if (meta) {
        log_contract_state()
        return res.send({
            nonce: meta.nonce.toString(),
            cid: meta.cid
        });
    } else {
        log_contract_state()
        return res.send({
            nonce: "0",
            cid: ""
        });
    }
}

function updateFileMeta(cid, hk, metadata, dids, access_bits, res) {
    let old_dids = undefined;

    if (!dids[0]) {
        let entry = SamOS.files_meta[hk];
        if (entry) {
            old_dids = entry.access_list;
        } else {
            old_dids = [];
        }
    } else {
        old_dids = dids;
    }

    let nonce = 1;
    // check for the last nonce if any
    if (SamOS.files_meta.hasOwnProperty(hk)) {
        nonce = SamOS.files_meta[hk].nonce + 1;
    }

    let meta = {
        access_list: old_dids,
        cid,
        nonce,
        db_meta: metadata,
    };
    SamOS.files_meta[hk] = meta;
    let index = 0;

    for (var i = 0; i < dids.length; i++) {
        let did = dids[i];
        if (did) {
            let files = SamOS.access_list[did] ? SamOS.access_list[did] : {};
            if (!access_bits[index])
                files[hk] = "-1";
            else {
                // keep it as is or set to 0
                if (SamOS.access_list.hasOwnProperty(did)) {
                    if (SamOS.access_list[did].hasOwnProperty(hk)) {
                        files[hk] = SamOS.access_list[did][hk];
                    } else {
                        files[hk] = "0";
                    }
                } else {
                    files[hk] = "0";
                }
            }

            // 0 means infinity and there's no cap on time for now
            index += 1;
            SamOS.access_list[did] = files;
        }
    }

    log_contract_state();
    res.send({})
}

function revokeAppAccess(file_key, app_did, revoke, res) {
    let entry = SamOS.access_list[app_did];
    if (entry) {
        entry[file_key] = revoke ? -1 : 0;

        log_contract_state()
        return res.send({
            revoked: true
        })
    }

    log_contract_state()
    return res.send({
        revoked: false
    });
}

function getRandomFiles(did, res) {
    let files = SamOS.access_list[did];
    let str = "";

    if (files) {
        for (const f in files) {
            let meta = SamOS.files_meta[f];
            // first add the access list
            str += `${meta.access_list[0]}--${meta.access_list[1]}##`;
            // then nonce
            str += `${meta.nonce}##`;
            // then access bit
            str += `${files[f]}##`;
            // then cid
            str += `${meta.cid}##`;
            // then the hashkey
            str += `${f}####`;
        }
    }

    log_contract_state()
    return res.send({
        res: str
    });
}

// log contract state
function log_contract_state() {
    console.log(SamOS);
}

// set views
app.set('views', './views');
app.set('view engine', 'ejs');

app.post('/create-new-account', (req, res) => {
    req = req.body;
    createNewAccount(req.did, req.auth_content, req.did_doc_cid, res)
});

app.post('/account-is-auth', (req, res) => {
    req = req.body;
    accountIsAuth(req.did, req.auth_content, req.is_auth, res)
});

app.post('/get-file-sync-info', (req, res) => {
    req = req.body;
    getFileSyncInfo(req.hashkey, res)
});

app.post('/update-file-meta', (req, res) => {
    req = req.body;
    updateFileMeta(req.cid, req.hashkey, req.metadata, req.dids, req.access_bits, res);
});

app.post('/get-random-files', (req, res) => {
    req = req.body;
    getRandomFiles(req.cid, res);
});

app.post('/revoke-app-access', (req, res) => {
    req = req.body;
    revokeAppAccess(req.file_key, req.app_did, req.revoke, res);
});

app.get('/clear', (req, res) => {
    SamOS = {
        auth_list: {},
        files_meta: {},
        access_list: {}
    }; 
    res.send({});
});


// listen on port 3000
app.listen(port, () => console.info(`listening on port ${port}`));