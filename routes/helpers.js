var mongoose = require('mongoose');
var db = mongoose.connection;

async function findDocs(word) {
    return new Promise(async function (resolve, reject) {
        await db.collection('index').findOne({ 'word': word }, function (err, ret) {
            if (ret) {
                resolve(ret.documents);
            } else {
                resolve([]);
            }
        });
    });
}

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
            var time = Date.now() / 1000;
            var lim = 25;
            if (v.timestamp != null && parseFloat(v.timestamp)) { //valid Unix time representation
                time = parseFloat(v.timestamp);
                console.log(time);
            } else if (v.timestamp != null && !parseFloat(v.timestamp)) { //invalid Unix time representation
                res.status(400);
                resolve({ status: "error", error: 'Invalid timestamp format' });
            }
            if (v.limit != null && parseInt(v.limit) >= 0 && parseInt(v.limit) <= 100) { //valid limit provided
                lim = parseInt(v.limit);
            } else if (v.limit != null) { //invalid limit
                res.status(400);
                resolve({ status: "error", error: 'Invalid limit provided' });
            }
            console.log("SEARCH PARAMS:: timestamp: " + time + "; limit: " + lim + ", phrase: " + v.q);
            if (v.q) { //search with phrase
                let phrase = v.q.toLowerCase();
                let array = phrase.split(" ");
                let docsContainingWords = new Set();
                for (let i = 0; i < array.length; i++) {
                    let docs = await findDocs(array[i]);
                    for (let j = 0; j < docs.length; j++) {
                        docsContainingWords.add(docs[j]);
                    }
                }
                docsContainingWords = Array.from(docsContainingWords);
                if (docsContainingWords.length > 0) {
                    await db.collection('questions').find({ timestamp: { $lte: time }, _id: { $in: docsContainingWords } }).sort({ timestamp: -1 }).limit(lim).toArray(function (err, questions) {
                        if (err) {
                            res.status(400);
                            resolve({ status: "error", error: err })
                        }
                        else {
                            var count = questions.length;
                            if (count <= 0) {
                                resolve({ status: "OK", questions: [] });
                            }
                            questions.forEach(function (question) {
                                if (question && question.timestamp <= time) {
                                    var modifiedquestion =
                                    {
                                        id: question._id,
                                        user: question.user,
                                        title: question.title,
                                        body: question.body,
                                        score: question.score,
                                        view_count: question.viewers.length,
                                        timestamp: question.timestamp,
                                        media: question.media,
                                        tags: question.tags,
                                        accepted_answer_id: question.accepted_answer_id
                                    }
                                    var get_answer_count = new Promise(async function (resolve, reject) {
                                        db.collection('answers').countDocuments({ 'questionId': question._id }, function (err, count) {
                                            if (err) {
                                                res.status(400);
                                                resolve({ status: "error", error: err })
                                            }
                                            else {
                                                resolve(count);
                                            }
                                        });
                                    });
                                    var get_user = new Promise(async function (resolve, reject) {
                                        await db.collection('users').findOne({ 'username': question.user }, function (err, user) {
                                            if (user) {
                                                resolve({ username: user.username, reputation: user.reputation });
                                            }
                                            else {
                                                res.status(400);
                                                resolve({ status: "error", error: err });
                                            }
                                        });
                                    });
                                    get_answer_count.then(function (result) {
                                        modifiedquestion.answer_count = result;
                                        get_user.then(function (result1) {
                                            modifiedquestion.user = result1;
                                            ret.push(modifiedquestion);
                                            count--;
                                            if (count == 0) {
                                                resolve(ret);
                                            }
                                        })
                                    })
                                }
                                else {
                                    count--;
                                    if (count == 0) {
                                        resolve(ret);
                                    }
                                }
                            });
                        }
                    });
                } else {
                    resolve({ status: "OK", questions: [] });
                }
            } else {
                await db.collection('questions').find({ timestamp: { $lte: time } }).sort({ timestamp: -1 }).limit(lim).toArray(function (err, questions) {
                    if (err) {
                        res.status(400);
                        resolve({ status: "error", error: err })
                    }
                    else {
                        var count = questions.length;
                        questions.forEach(function (question) {
                            if (question && question.timestamp <= time) {
                                var modifiedquestion =
                                {
                                    id: question._id,
                                    user: question.user,
                                    title: question.title,
                                    body: question.body,
                                    score: question.score,
                                    view_count: question.viewers.length,
                                    timestamp: question.timestamp,
                                    media: question.media,
                                    tags: question.tags,
                                    accepted_answer_id: question.accepted_answer_id
                                }

                                var get_answer_count = new Promise(async function (resolve, reject) {
                                    db.collection('answers').countDocuments({ 'questionId': question._id }, function (err, count) {
                                        if (err) {
                                            res.status(400);
                                            resolve({ status: "error", error: err })
                                        }
                                        else {
                                            resolve(count);
                                        }
                                    });
                                });
                                var get_user = new Promise(async function (resolve, reject) {
                                    await db.collection('users').findOne({ 'username': question.user }, function (err, user) {
                                        if (user) {
                                            resolve({ username: user.username, reputation: user.reputation });
                                        }
                                        else {
                                            res.status(400);
                                            resolve({ status: "error", error: err });
                                        }
                                    });
                                })
                                get_answer_count.then(function (result) {
                                    modifiedquestion.answer_count = result;
                                    get_user.then(function (result1) {
                                        modifiedquestion.user = result1;
                                        ret.push(modifiedquestion);
                                        count--;
                                        if (count == 0) {
                                            resolve(ret);
                                        }
                                    })
                                })
                            }
                            else {
                                count--;
                                if (count == 0) {
                                    resolve(ret);
                                }
                            }
                        });
                    }
                });
            }
        });
    },
    getQuestion: async function (req, res) {
        return new Promise(async function (resolve, reject) {
            var qid = req.params.id;
            var viewer = req.params.viewer;
            await db.collection('questions').findOne({ '_id': qid }, function (err, ret1) {
                if (ret1) {
                    var question = {
                        id: req.params.id.toString(),
                        user: ret1.user,
                        title: ret1.title,
                        body: ret1.body,
                        score: ret1.score,
                        view_count: ret1.viewers.length,
                        timestamp: ret1.timestamp,
                        media: ret1.media,
                        tags: ret1.tags,
                        accepted_answer_id: ret1.accepted_answer_id
                    };
                    if (!ret1.viewers.includes(viewer)) {
                        question.view_count += 1;
                        ret1.viewers.push(viewer);
                        db.collection('questions').updateOne({ _id: qid }, { $set: { viewers: ret1.viewers } });
                    }
                    resolve(question);
                }
                else {
                    res.status(404);
                    resolve({ status: "error", error: "No question with this ID" });
                }

            });
        });
    },
    getAnswers: async function (req, res) {
        return new Promise(async function (resolve, reject) {
            var ret = [];
            var qid = req.params.id.toString();
            await db.collection('questions').findOne({ '_id': qid }, function (err, ret1) {
                if (!ret1) {
                    res.status(404);
                    resolve({ status: "error", error: "No question with this ID" });
                }
            });
            await db.collection('answers').find({ 'questionId': qid }).forEach(function (answer, err) {
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
    getAnswerCount: async function (req, res) {
        return new Promise(async function (resolve, reject) {
            var qid = req.params.id;
            await db.collection('answers').countDocuments({ 'questionId': qid }, function (err, count) {
                resolve(count);
            });
        });
    },
    getUserOfQuestion: async function (req, res) {
        return new Promise(async function (resolve, reject) {
            await db.collection('users').findOne({ 'username': req.params.user }, function (err, user) {
                if (user) {
                    resolve({ username: user.username, reputation: user.reputation });
                }
                else {
                    res.status(404);
                    resolve({status: "error", error: "No such User"});
                }
            });
        });
    },
    getUserInfo: async function (req, res) {
        return new Promise(async function (resolve, reject) {
            await db.collection('users').findOne({ 'username': req.params.user }, function (err, user) {
                if (user) {
                    resolve({ email: user.email, reputation: user.reputation });
                }
                else {
                    res.status(404);
                    resolve({ status: "error", error: "No such User" });
                }
            });
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
    },
    deleteQuestion: async function(req, res){
        return new Promise(async function (resolve, reject) {
            var user = undefined;
            var qid = req.params.id;
            await db.collection('questions').findOne({'_id': qid}, function(err, ret1){
                if (req.params.user == ret1.user) {
                    user = req.params.user;
                    var text = ret1.title + " " + ret1.body;
                    for (var i = 0; i < ret1.tags.length; i++) {
                        text += " " + ret1.tags[i];
                    }
                    text = text.toLowerCase().split(" ");
                    text = new Set(text);
                    text.forEach(function (word) {
                        db.collection('index').findOne({ 'word': word }, function (err, ret) {
                            if (ret) { //word has occurred before: update array
                                let newDocuments = ret.documents;
                                var index = newDocuments.indexOf(qid);
                                if (index > -1) {
                                    newDocuments.splice(index, 1);
                                }
                                db.collection('index').updateOne({ word: word }, { $set: { documents: newDocuments } });
                            }
                        });
                    });
                    var deletePromise = new Promise(async function (resolve, reject) {
                        await db.collection('questions').remove({'_id': qid}, function(err, ret1){
                            if (ret1.nRemoved == 0){
                                resolve({status:404});
                            }
                            else{
                                resolve({status:200});
                            }
                        });
                    });
                    deletePromise.then(function (result) {
                        resolve(result);
                    });
                }
                else{ resolve({status:403});}
            });
            if (user){
                console.log(user);
            }


        })
    },
    //return an array of IDs for questions asked by a user
    getUserQuestions: async function (req, res) {
        return new Promise(async function (resolve, reject) {
            var ret = [];
            var username = req.params.username.toString();
            await db.collection('users').findOne({ 'username': username }, function (err, ret1) {
                if (!ret1) {
                    res.status(404);
                    resolve({ status: "error", error: "User not found." });
                }
            });
            await db.collection('questions').find({ 'user': username }).forEach(function (question) {
                if (question) {
                    ret.push(question._id);
                }
            });
            resolve(ret);
        });
    },
    //return an array of IDs for answers asked by a user
    getUserAnswers: async function (req, res) {
        return new Promise(async function (resolve, reject) {
            var ret = [];
            var username = req.params.username.toString();
            await db.collection('users').findOne({ 'username': username }, function (err, ret1) {
                if (!ret1) {
                    res.status(404);
                    resolve({ status: "error", error: "User not found." });
                }
            });
            await db.collection('answers').find({ 'user': username }).forEach(function (answer) {
                if (answer) {
                    ret.push(answer._id);
                }
            });
            resolve(ret);
        });
    },
}