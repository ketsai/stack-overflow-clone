var engines = require('consolidate');
var express = require('express');
var path = require('path');
var appRoot = require('app-root-path');
var morgan = require('morgan');
var winston = require('winston');
var expressWinston = require('express-winston');
var cookieParser = require('cookie-parser');
var bodyparser = require('body-parser');

var mongodb = require('./mongodb');
var dbRouter = require('./routes/db');
var indexRouter = require('./routes/index');
var app = express();

// view engine setup
app.engine('html', engines.ejs);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(morgan('combined', { stream: winston.stream.write }));
app.use(bodyparser.json({limit:'100mb'}));
app.use(bodyparser.urlencoded({limit:'100mb', extended: true, parameterLimit: 50000}));
app.use(cookieParser());

expressWinston.requestWhitelist.push('body');
app.use(expressWinston.logger({
    transports: [
        new winston.transports.File({
            level: 'info',
            filename: `${appRoot}/logs/app.log`,
            handleExceptions: true,
            json: true,
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            colorize: false,
        }),
        new winston.transports.Console({
            level: 'error'
        })
    ],
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.json()
    ),
    meta: true, // optional: control whether you want to log the meta data about the request (default to true)
    msg: "HTTP {{req.method}} {{req.url}} {{req.body}} {{req.params}} {{res.responseTime}}ms", // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
    expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
    colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
}));

app.use('/', indexRouter);
app.use('/', dbRouter);


//start server
app.listen(80, ()=> console.log('Project listening on port 80'));

module.exports = app;
