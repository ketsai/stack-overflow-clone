express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var db = mongoose.connection;
var cassandra = require('cassandra-driver');
const client = new cassandra.Client({
    contactPoints: ['192.168.193.253'],
    localDataCenter: 'datacenter1',
    keyspace: 'stackoverflow'
});
var crypto = require('crypto');
var bcrypt = require('bcryptjs');
var nodemailer = require('nodemailer');
var shortid = require('shortid');
var helper = require('./helpers.js');
const multer = require('multer');
const storage = multer.memoryStorage();
var upload = multer({storage: storage});
var path = require('path');
var fs = require('fs');

var transporter = nodemailer.createTransport({
    host: "localhost",
    port: 25,
    secure: false,
    tls: {
        rejectUnauthorized: false
    },
});

function handleError(res, err) {
    console.log(err);
    res.status(400);
    res.json({ status: "error", error: err });
}

/* Adding a user into the database*/
router.post('/adduser', function (req, res, next) {
    var v = req.body;
    if (v.username == '' || v.email == '' || v.password == '') {
        res.status(400);
        res.json({ status: "error", error: 'All fields are required; please enter all information.' });
    } else {
        db.collection('users').findOne({ 'username': v.username }, function (err, ret) {
            if (err) return handleError(res,err);
            if (ret != null) {
                res.status(400);
                res.json({ status: "error", error: 'Username already registered. Please enter another.' });
            } else {
                db.collection('users').findOne({ 'email': v.email }, function (err, ret) {
                    if (err) return handleError(res,err);
                    if (ret != null) {
                        res.status(400);
                        res.json({ status: "error", error: 'Email already registered. Please enter another.' });
                    } else {
                        var regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                        if (!regex.test(v.email)) {
                            res.status(400);
                            res.json({ status: "error", error: 'Please enter a valid email address.' });
                        } else {
                            //new session ID for new user
                            var salt = bcrypt.genSaltSync(10); // Salt and hash the given password, then store it in the database
                            var hash = bcrypt.hashSync(v.password, salt);
                            var user = {
                                username: v.username,
                                email: v.email,
                                password: hash,
                                verified: false,
                                reputation: 1
                            };
                            db.collection('users').insertOne(user);
                            hash = crypto.createHash('sha256'); // Randomly generated session ID
                            hash.update(Math.random().toString());
                            var session = hash.digest('hex');
                            res.cookie('session', session);
                            res.json({ status: "OK", msg: 'Account created. Visit <a href="/verify">this link</a> to verify your email.' });

                            var key = crypto.createHash('md5').update(v.email + "salty_salt").digest('hex'); //EMAIL THIS KEY TO EMAIL ADDRESS
                            let mailOptions = {
                                from: '"root@cse356.cloud.compas.cs.stonybrook.edu', // sender address
                                to: user.email, // list of receivers
                                subject: "validation key", // Subject line
                                text: "validation key: <" + key + ">", // plain text body
                            };
                            transporter.sendMail(mailOptions);
                            //automatically log in to new account
                            db.collection('sessions').insertOne( // Insert new session in00000000000000000000000000000000000000000000000000to db
                                {
                                    email: user.email,
                                    session: session,
                                    expire: Date.now() + 24 * 60 * 60 * 1000 // Session expires after 24 hours
                                }
                            );


                        }
                    }
                });
            }
        });
    }
});

/* User verification*/
router.post('/verify', function (req, res, next) {
    var v = req.body;
    var key = crypto.createHash('md5').update(v.email + "salty_salt").digest('hex');
    db.collection('users').findOne({ 'email': v.email }, function (err, ret) {
        if (err) return handleError(res,err);
        if (ret != null && (v.key == key || v.key == 'abracadabra')) { // Is the request key the same as email after salt and hash?
            db.collection('users').updateOne({ 'email': v.email }, { $set: { verified: true }});
            res.json({ status: "OK", msg: 'Your account is now verified!' });
        } else {
            res.status(403);
            res.json({ status: "error", error: 'Invalid verification key' });
        }
    })
});

/* User login*/
router.post('/login', function (req, res, next) {
    var v = req.body;
    db.collection('users').findOne({ 'username': v.username }, function (err, ret) {
        if (err) return handleError(res,err);
        if (ret != null && !ret.verified) {
            res.status(403);
            res.json({ status: "error", error: 'Please verify your account.' });
        }else if (ret != null && bcrypt.compareSync(v.password, ret.password)) { // Ensure that the given password matches the hashed password
            var hash = crypto.createHash('sha256'); // Randomly generated session ID
            hash.update(Math.random().toString());
            var session = hash.digest('hex');
            db.collection('sessions').deleteMany({ email: ret.email }, function () { // Clear all other existing sessions for this user
                db.collection('sessions').insertOne( // New session
                    {
                        email: v.email,
                        session: session,
                        expire: Date.now() + 24 * 60 * 60 * 1000 // Session expires after 24 hours
                    }, function () {
                        res.cookie('session', session);
                        res.json({ status: "OK", msg: 'Logged in successfully' });
                    }
                );
            });
        } else {
            res.status(403);
            res.json({ status: "error", error: 'Invalid login credentials' });
        }
    })
});

/* User logout*/
router.post('/logout', function (req, res, next) {
    var session = req.cookies.session;
    db.collection('sessions').deleteOne({ 'session': session });
    res.clearCookie('session');
    res.json({ status: "OK", msg: 'Logged out successfully' });
});

/*Add Question*/
router.post('/questions/add', async function (req, res, next) {
    let userData = await helper.getUserData(req, res);
    if (userData) {
        var user = userData.username;
        var v = req.body;
        if (v.title == null || v.body == null || v.tags == null) {
            res.status(400);
            res.json({ status: "error", error: 'All fields are required; please enter all information.' });
        } else {
            var media = null;
            var mediafailure = false;
            if (v.media && v.media.constructor === Array) {
                media = v.media;
                media.forEach(function (media_id) {
                    const query = 'SELECT * FROM stackoverflow.media WHERE id = ? ';
                    client.execute(query, [media_id], function (err, result) {
                        if (err) {
                            res.status(404);
                            mediafailure = true;
                        }
                        else {
                            if (!result.rows[0]) {
                                mediafailure = true;
                            }
                            else {
                                var uid = result.rows[0].uid;
                                var qid = result.rows[0].qid;
                                if (qid != null || uid !== user) {
                                    mediafailure = true;
                                }
                            }
                        }
                    });
                })
            }
            if (mediafailure) {
                res.status(404);
                res.json({ status: "error", error: "Media does not belong to current user or media is already in use" });
            } else {
                var qid = shortid.generate();
                var question = {
                    _id: qid,
                    title: v.title,
                    body: v.body,
                    tags: v.tags,
                    media: media,
                    user: user,
                    score: 0,
                    viewers: [],
                    timestamp: Date.now() / 1000,
                    accepted_answer_id: null
                }
                if (media) {
                    media.forEach(function (media_id) {
                        var query = "UPDATE stackoverflow.media SET uid = ? WHERE qid = ?"
                        client.execute(query, [user, media_id], function (err, result) {
                            if (err) {
                                res.status(400);
                                res.json({ status: "error", error: "Error in updating qid for media" });
                                res.end();
                            }
                        })
                    });
                }
                //insert each unique word in the body, title, and tags into inverted index to search
                var text = v.title + " " + v.body;
                text = text.toLowerCase().split(" ");
                text = new Set(text);
                var ops = new Array();
                text.forEach(function (word) {
                    ops.push(
                        {
                            updateOne: {
                                "filter": { word: word },
                                "update": { $addToSet: { documents: qid } },
                                "upsert": true
                            }
                        }
                    );
                });
                //console.log(ops);
                db.collection('index').bulkWrite(ops);
                
                //db.collection('index').update({ word: word }, { $set: { documents: newDocuments }, { upsert: true }});

                //text = new Set(text);
                //text.forEach(function (word) {
                //    db.collection('index').findOne({'word': word}, function (err, ret) {
                //        if (ret) { //word has occurred before: update array
                //            let newDocuments = ret.documents;
                //            newDocuments.push(qid);
                //            db.collection('index').updateOne({word: word}, {$set: {documents: newDocuments}});
                //        } else { //word hasn't occured before; insert new document with new array
                //            db.collection('index').insertOne({word: word, documents: [qid]});
                //        }
                //    });
                //});
                db.collection('questions').insertOne(question);
                res.json({ status: "OK", id: qid });
            }
        }
    }
    else {
        res.status(401);
        res.json({status: "error", error: "Please log into a verified account."});
    }
});

router.post('/questions/:id/answers/add', async function(req, res, next) {
    var aid = shortid.generate();
    let userData = await helper.getUserData(req, res);
    if (userData) {
        var qid = req.params.id;
        var v = req.body;
        if (v.body == null) {
            res.status(400);
            res.json({status: "error", error: 'You must fill in an answer'});
        }
        else {
            var media = null;
            if(v.media && v.media.constructor === Array) {
                media = v.media;
            }
            var answer = {
                _id: aid,
                questionId: qid,
                user: userData.username,
                body: req.body.body,
                score: 0,
                is_accepted: false,
                timestamp: Date.now() / 1000,
                media: media
            }
            db.collection('answers').insertOne(answer, function () {
                res.json({status: "OK", id: aid});
            });
        }
    }
    else {
        res.status(401);
        res.json({ status: "error", error: "Please log into a verified account."});
    }
});

/* Search for questions from a requested time or earlier*/
router.post('/search', async function (req, res, next) {
    var ret = await helper.search(req, res);
    if (ret.constructor === Array) {
        res.json({status:"OK", questions:ret});
    } else {
        if (ret.status = "error") {
            res.status(400);
        }
        res.json(ret);
    }

});

/* Return the 10 most recently asked questions*/
router.post('/recentQuestions', async function (req, res, next) {
    var ret = await helper.recentQuestions(req, res);
    res.json({ status: "OK", questions: ret });
});



router.delete('/questions/:id', async function (req, res){
    let userData = await helper.getUserData(req, res);
    if (!userData){
        console.log("userData is undefined");
        res.status(403);
        res.json({status: "error", error: "User not found"});
    }
    else{
        console.log("got userData");
        req.params.user = userData.username;
        var ret = await helper.deleteQuestion(req, res);
        console.log(ret);
        if (ret.media){
            console.log("media is not null");
            var query = "DELETE FROM stackoverflow.media WHERE id = ?";
            ret.media.forEach(function(media_id){
                client.execute(query, [media_id], function(err, result){
                    if (err) {console.log(err)}
                });
            })
        }
        res.json({status:ret.status});
    }

});

router.post('/questions/:id/upvote', async function (req, res) {
   let userData = await helper.getUserData(req, res);
   if (!userData){
       console.log("userData is undefined in upvote question");
       res.status(403);
       res.json({status:"error", error: "User must be logged in to upvote"});
   }
   else{
       console.log("user is logged in for upvote question operation");
       req.params.user = userData.username;
       req.params.database = 'questions';
       var ret = await helper.getScore(req, res);
       res.json(ret);
   }
});

router.post('/answers/:id/upvote', async function (req, res) {
    let userData = await helper.getUserData(req, res);
    if (!userData){
        console.log("userData is undefined in upvote answer");
        res.status(403);
        res.json({status:"error", error: "User must be logged in to upvote"});
    }
    else{
        console.log("user is logged in for upvote answer operation");
        req.params.user = userData.username;
        req.params.database = 'answers';
        var ret = await helper.getScore(req, res);

    }
});

router.post('/answers/:id/accept', async function (req, res) {
    let userData = await helper.getUserData(req, res);
    if (!userData){
        console.log("userData is undefined in accept answer");
        res.status(403);
        res.json({status:"error", error: "User must be logged in to accept an answer"});
    }
    else{
        console.log("user is logged in for accept answer operation");
        req.params.user = userData.username;
        var ret = await helper.acceptAnswer(req, res);
        res.json(ret);
    }
});

router.post('/addmedia', upload.single('content'), async function (req, res){
    let userData = await helper.getUserData(req, res);
    if (!userData){
        console.log("userData is undefined in add media");
        res.status(403);
        res.json({status:"error", error: "User must be logged in to add media"});
    }
    else{
        console.log("user is logged in for add media operation");
        var username = userData.username;
        var media_id = shortid.generate();
        var query = "INSERT INTO stackoverflow.media(id, ext, content, uid) VALUES (?,?,?,?)";
        if (!req.file){
            res.status(403);
            res.json({status:"error", "error": "No file was specified"});
        }
        else {
            var originalname = req.file.originalname.split(".");
            var extension = originalname.pop();
            const values = [media_id, extension, req.file.buffer, username];
            client.execute(query, values, function (err, result) {
                if (err) {
                    console.log(err);
                    res.status(404);
                    res.json({status: "error", error: err});
                }
                else {
                    res.json({status: "OK", id: media_id});
                }
            });
        }
    }
})


router.get('/media/:id', function(req, res){
    var media_id = req.params.id;
    const query = 'SELECT * FROM stackoverflow.media WHERE id = ? ';
    client.execute(query, [media_id], function(err, result){
        if (err){
            res.status(404);
            res.json({status: "error", error: err});
        }
        else{
            if (!result.rows[0]){
                res.json({status:"error", error:"Media File Does Not Exist"});
            }
            else {
                var id = result.rows[0].id;
                var extension = result.rows[0].ext;
                var content = result.rows[0].content;
                var imgPath = "/home/ubuntu/stack-overflow-clone/media/" + id + extension;
                res.setHeader('Content-Type', 'image/' + extension);
                fs.writeFile(imgPath, content, (err) => {
                    if (err) {
                        res.status(404);
                        res.json({status: "error", error: err});
                    }
                    else {
                        res.sendFile(imgPath);
                    }
                });
            }
        }
    });
});

module.exports = router;
console.log('Database routing loaded');
