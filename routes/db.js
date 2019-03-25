express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var db = mongoose.connection;
var crypto = require('crypto');
var bcrypt = require('bcryptjs');
var nodemailer = require('nodemailer');
var helper = require('./helpers.js');

function handleError(res, err) {
    console.log(err);
    res.json({ status: "error", error: err });
}

/* Adding a user into the database*/
router.post('/adduser', function (req, res, next) {
    var v = req.body;
    if (v.username == '' || v.email == '' || v.password == '') {
        res.json({ status: "error", error: 'All fields are required; please enter all information.' });
    } else {
        db.collection('users').findOne({ 'username': v.username }, function (err, ret) {
            if (err) return handleError(res,err);
            if (ret != null) {
                res.json({ status: "error", error: 'Username already registered. Please enter another.' });
            } else {
                db.collection('users').findOne({ 'email': v.email }, function (err, ret) {
                    if (err) return handleError(res,err);
                    if (ret != null) {
                        res.json({ status: "error", error: 'Email already registered. Please enter another.' });
                    } else {
                        var regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                        if (!regex.test(v.email)) {
                            res.json({ status: "error", error: 'Please enter a valid email address.' });
                        } else {
                            var salt = bcrypt.genSaltSync(10); // Salt and hash the given password, then store it in the database
                            var hash = bcrypt.hashSync(v.password, salt);
                            var user = {
                                username: v.username,
                                email: v.email,
                                password: hash,
                                verified: false
                            };
                            db.collection('users').insertOne(user);

                            var key = crypto.createHash('md5').update(v.email + "salty_salt").digest('hex'); //EMAIL THIS KEY TO EMAIL ADDRESS
                            let transporter = nodemailer.createTransport({
                                host: "localhost",
                                port: 25,
                                secure: false,
                                tls: {
                                    rejectUnauthorized: false
                                },
                            });
                            let mailOptions = {
                                from: '"root@cse356.cloud.compas.cs.stonybrook.edu', // sender address
                                to: user.email, // list of receivers
                                subject: "validation key", // Subject line
                                text: "validation key: <" + key + ">", // plain text body
                            };
                            transporter.sendMail(mailOptions);
                            
                            //automatically log in to new account
                            var hash = crypto.createHash('sha256'); // Randomly generated session ID
                            hash.update(Math.random().toString());
                            var session = hash.digest('hex');
                            db.collection('sessions').insertOne( // New session
                                {
                                    username: user.username,
                                    session: session,
                                    expire: Date.now() + 24 * 60 * 60 * 1000 // Session expires after 24 hours
                                }, function () {
                                    res.cookie('session', session);
                                    res.json({ status: "OK", msg: 'Account created. Visit <a href="/verify">this link</a> to verify your email.' });
                                }
                            )
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
            res.json({ status: "error", error: 'Please verify your account.' });
        }else if (ret != null && bcrypt.compareSync(v.password, ret.password)) { // Ensure that the given password matches the hashed password
            var hash = crypto.createHash('sha256'); // Randomly generated session ID
            hash.update(Math.random().toString());
            var session = hash.digest('hex');
            db.collection('sessions').deleteMany({ username: v.username }, function () { // Clear all other existing sessions for this user
                db.collection('sessions').insertOne( // New session
                    {
                        username: v.username,
                        session: session,
                        expire: Date.now() + 24 * 60 * 60 * 1000 // Session expires after 24 hours
                    }, function () {
                        res.cookie('session', session);
                        res.json({ status: "OK", msg: 'Logged in successfully' });
                    }
                );
            });
        } else {
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

/* Search for a question from a requested time or earlier*/
router.post('/search', async function (req, res, next) {
    var ret = await helper.search(req, res);
    if (ret.constructor === Array) {
        res.json({ status: "OK", questions: ret });
    } else {
        res.json(ret)
    }
});

module.exports = router;
console.log('Database routing loaded');