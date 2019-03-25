var engines = require('consolidate');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');

var mongodb = require('./mongodb');
var dbRouter = require('./routes/db');
var indexRouter = require('./routes/index');
var app = express();

// view engine setup
app.engine('html', engines.ejs);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({limit:'50mb'}));
app.use(express.urlencoded({limit:'50mb', extended: false}));
app.use(cookieParser());

app.use('/', indexRouter);
app.use('/', dbRouter);

//start server
app.listen(80, ()=> console.log('Project listening on port 80'));

module.exports = app;
