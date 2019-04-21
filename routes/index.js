var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var db = mongoose.connection;
var helper = require('./helpers.js');

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

router.get('/questions/:id', async function(req, res, next) {
    let userData = await helper.getUserData(req, res);
    var viewer = req.ip;
    if (userData) {
        viewer = userData.username;
    }
    req.params.viewer = viewer;
    var question = await helper.getQuestion(req, res);
    if (question.status == "error") {
        res.json(question);
    }
    else {
        req.params.user = question.user;
        var answer_count = await helper.getAnswerCount(req, res);
        var user = await helper.getUserOfQuestion(req, res);
        question.user = user;
        question.answer_count = answer_count;
        res.json({ status: "OK", question: question });
    }
});

router.get('/questions/:id/answers', async function(req, res, next){
    var ret = await helper.getAnswers(req, res);
    if (ret.constructor === Array) {
        res.json({ status: "OK", answers: ret });
    } else {
        res.json(ret)
    }
});

router.get('/user/:username', async function(req, res){
    req.params.user = req.params.username;
    var user = await helper.getUserInfo(req, res);
    if (user.status == "error") {
        res.json(user);
    }
    else{
        res.json({status: "OK", user: user});
    }
});

router.get('/user/:username/questions', async function (req, res, next) {
    var ret = await helper.getUserQuestions(req, res);
    if (ret.constructor === Array) {
        res.json({ status: "OK", questions: ret });
    } else {
        res.json(ret);
    }
});

router.get('/user/:username/answers', async function (req, res, next) {
    var ret = await helper.getUserAnswers(req, res);
    if (ret.constructor === Array) {
        res.json({ status: "OK", answers: ret });
    } else {
        res.json(ret);
    }
});

module.exports = router;
console.log('Index routing loaded')