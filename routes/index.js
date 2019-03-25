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

module.exports = router;
console.log('Index routing loaded')