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
    },
    getQuestion: async function(req, res){
        return new Promise(async function (resolve, reject) {
            var ret = {};
            var qid = req.params.id;
            var viewer = req.params.viewer;
            await db.collection('questions').findOne({'_id': qid}, function(err, ret1){
                if (ret1){
                    db.collection('answers').countDocuments({'questionId': qid}, function(err, count){
                        ret.count = count;
                    });
                    db.collection('users').findOne({'username': ret1.user}, function (err, user){
                        if (user){
                            ret.user = { user: user.username, reputation: user.reputation};
                        }
                    });
                    ret.status = "OK";
                    ret.question = {
                        id : req.params.id.toString(),
                        title: ret1.title,
                        body: ret1.body,
                        score: ret1.score,
                        view_count: ret1.viewers.length,
                        timestamp: ret1.view_count,
                        media: ret1.media,
                        tags: ret1.tags,
                        accepted_answer_id: ret1.accepted_answer_id
                    };
                    if (!ret1.viewers.includes(viewer)){
                        ret.view_count += 1;
                        ret1.viewers.push(viewer);
                        db.collection('questions').updateOne({_id: ret.id}, {$set: {viewers: ret1.viewers}});
                    }
                    resolve({status: "OK", question: ret});
                }
                else{
                    resolve({status: "error", error: "No question with this ID"});
                }

            });
        });
    },
    getAnswers: async function(req, res) {
        return new Promise(async function (resolve, reject) {
            var ret = [];
            var qid = req.params.id.toString();
            await db.collection('questions').findOne({'_id': qid}, function (err, ret1) {
                if (!ret1) {
                    resolve({status: "error", error: "No question with this ID"});
                }
            });
            await db.collection('answers').find({'questionId': qid}).forEach(function (answer, err) {
                if (answer) {
                    var modifiedAnswer = {
                        id: answer._id,
                        user: answer.user,
                        body: answer.body,
                        score: answer.score,
                        is_accepted: answer.is_accepted,
                        timestamp: answer.timestamp,
                        media: answer.media
                    }
                    ret.push(modifiedAnswer);
                }
            });
            resolve(ret);
        });
    },
    //return the 10 most recently asked questions
    recentQuestions: async function (req, res) {
        return new Promise(async function (resolve, reject) {
            var ret = [];
            await db.collection('questions').find().sort({ timestamp: -1 }).limit(10).forEach(function (question, err) {
                if (question) {
                    ret.push(question);
                }
            });
            resolve(ret);
        });
    }
}