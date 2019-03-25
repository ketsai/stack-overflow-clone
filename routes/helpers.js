var mongoose = require('mongoose');
var db = mongoose.connection;

module.exports = {
    // Find who is logged in
    getUserData: async function (req, res) {
        return new Promise(function (resolve, reject) { // Create promise for retrieving user data
            var session = req.cookies.session;
            if (session) {
                db.collection('sessions').findOne({ 'session': session }, function (err, ret) {
                    if (err) return handleError(err);
                    if (ret) {
                        if (ret.expire < Date.now()) { // Session expired, remove from db
                            console.log("Removing expired session.");
                            db.collection('sessions').deleteOne({ 'session': session });
                            res.clearCookie('session');
                            resolve();
                        }
                        db.collection('users').findOne({ 'username': ret.username }, function (err, ret) {
                            if (ret) { // User found
                                console.log("User: " + ret.username);
                                resolve(ret);
                            }
                        });
                    } else { // Session not found
                        console.log("Session could not be found. Removing cookie.");
                        res.clearCookie('session');
                        resolve();
                    }
                })
            } else { // No session cookie
                console.log("No session cookie - no user logged in.");
                resolve();
            }
        });
    },
    //search for {res.limit} responses at or before {res.timestamp}
    search: async function (req, res) {
        return new Promise(async function (resolve, reject) {
            var ret = [];
            var v = req.body;
            var time = Date.now();
            var lim = 25;
            if (v.timestamp != null && parseInt(v.timestamp)) { //valid Unix time representation
                time = parseInt(v.timestamp);
            } else if (v.timestamp != null && !parseInt(v.timestamp)) { //invalid Unix time representation
                resolve({ status: "error", error: 'Invalid timestamp format' });
            }
            if (v.limit != null && parseInt(v.limit) >= 0 && parseInt(v.limit) <= 100) { //valid limit provided
                lim = parseInt(v.limit);
            } else if (v.limit != null) { //invalid limit
                resolve({ status: "error", error: 'Invalid limit provided' });
            }
            await db.collection('questions').find().sort({ timestamp: -1 }).forEach(function (question, err) {
                if (question && question.timestamp <= time && ret.length < lim) {
                    ret.push(question);
                }
            });
            resolve(ret);
        });
    }
}