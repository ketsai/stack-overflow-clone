var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var db = mongoose.connection;
var helper = require('./helpers.js');

router.get('/ttt', async function (req, res, next) {
    let user = await helper.getUserData(req, res);
    if (user) {
        var username = user.username;
        var verified = user.verified;
        if (verified) {
            var date = new Date();
            var dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
            res.render('gametime.html', { name: username, date: dateString });
        } else {
            res.render('home.html', { msg: "Hello " + username + ". Please <a href='/verify'>verify your email.</a>" });
        }
    } else {
        res.render('home.html', { msg: "Welcome! Please register or log in." });
    }
});

router.get('/login', async function (req, res, next) {
    let user = await helper.getUserData(req, res);
    if (user) {
        var username = user.username;
        var verified = user.verified;
        if (verified) {
            res.render('home.html', { msg: "Hello " + username + "." });
        } else {
            res.render('home.html', { msg: "Hello " + username + ". Please <a href='/verify'>verify your email.</a>" });
        }
    } else {
        res.render('login.html');
    }
});

router.get('/', async function (req, res, next) {
    let user = await helper.getUserData(req, res);
    if (user) {
        var username = user.username;
        var verified = user.verified;
        if (verified) {
            res.render('home.html', { msg: "Hello " + username + "." });
        } else {
            res.render('home.html', { msg: "Hello " + username + ". Please <a href='/verify'>verify your email.</a>" });
        }
    } else {
        res.render('home.html', { msg: "Welcome! Please register or log in." });
    }
});

router.get('/adduser', async function (req, res, next) {
    let user = await helper.getUserData(req, res);
    if (user) {
        var username = user.username;
        var verified = user.verified;
        if (verified) {
            res.render('home.html', { msg: "Hello " + username + "." });
        } else {
            res.render('home.html', { msg: "Hello " + username + ". Please <a href='/verify'>verify your email.</a>" });
        }
    } else {
        res.render('adduser.html');
    }
});

router.get('/verify', async function (req, res, next) {
    let user = await helper.getUserData(req, res);
    if (user) {
        var username = user.username;
        var verified = user.verified;
        if (verified) {
            res.render('home.html', { msg: "Hello " + username + "." });
        } else {
            res.render('verify.html');
        }
    } else {
        res.render('verify.html');
    }
});

router.get('/stats', async function (req, res, next) {
    let user = await helper.getUserData(req, res);
    if (user) {
        var username = user.username;
        var verified = user.verified;
        if (verified) {
            res.render('stats.html', { msg: "Hello " + username + "." });
        } else {
            res.render('home.html', { msg: "Hello " + username + ". Please <a href='/verify'>verify your email.</a>" });
        }
    } else {
        res.render('home.html', { msg: "Welcome! Please register or log in." });
    }
});


router.get('/questions/:id', function(req, res, next){
    var id = req.params.id;
    db.collection('questions').findOne({ '_id' : id}, function (err, ret){
        if (err) return handleError(err);
        if (ret){
            db.collection('users').findOne({'username': ret.username}, function (err2, ret2){
                if (err2) return handleError(err2);
                if (ret2){
                    db.collection('answers').countDocuments({'questionId': id}, function (err3,ret3){
                        if (err3) return handleError(err3);
                        if (ret3) {
                            res.json({
                                status: "OK",
                                question: {
                                    id: id,
                                    user: {
                                        username: ret2.username,
                                        reputation: ret2.reputation
                                    },
                                    title: ret.title,
                                    body: ret.body,
                                    score: ret.score,
                                    view_count: ret.viewers.length,
                                    answer_count: ret3,
                                    timestamp: ret.timestamp,
                                    media: ret.media,
                                    tags: ret.tags,
                                    accepted_answer_id: ret.accepted_answer_id
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

router.get('/questions/:id/answers', function(req, res, next){
    var id = req.params.id;
    db.collection('questions').findOne({ '_id' : id}, function (err, ret){
        if (err) return handleError(err);
        if (ret){
            db.collection('answers').countDocuments({'questionId': id}, function (err2,ret2){
                if (err2) return handleError(2);

            }
})

module.exports = router;
console.log('Index routing loaded')