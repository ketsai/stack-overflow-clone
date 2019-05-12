var mongoose = require('mongoose');
// mongodb://username:password@serverip:27017/dbname

var mongoDB = 'mongodb://192.168.193.253:27017/stack-overflow'; //cassandra instance
//var mongoDB = 'mongodb://192.168.193.150:27017,192.168.193.248:27017/stack-overflow'; //mongos shards
var options = {
    useNewUrlParser: true
}

mongoose.connect(mongoDB, options);

var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function() {
    console.log("Connected to Mongoose");
});