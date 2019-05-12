var mongoose = require('mongoose');
var db = mongoose.connection;

async function findWordDocs(word) {
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

async function findTagDocs(tag) {
    return new Promise(async function (resolve, reject) {
        await db.collection('tags').findOne({ 'word': word }, function (err, ret) {
            if (ret) {
                resolve(ret.documents);
            } else {
                resolve([]);
            }
        });
    });
}

async function prepareSearchResults(questions) {
    return new Promise(async function (resolve, reject) {
        var ret = [];
        var count = questions.length;
        if (count <= 0) {
            resolve({ status: "OK", questions: [] });
        }
        questions.forEach(function (question) {
            if (question) {
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
            } else {
                count--;
                if (count == 0) {
                    resolve(ret);
                }
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
                db.collection('sessions').findOne({ 'session': session }, function (err, ses) {
                    if (err) return handleError(err);
                    if (ses) {
                        if (ses.expire < Date.now()) { // Session expired, remove from db
                            console.log("Removing expired session.");
                            db.collection('sessions').deleteOne({ 'session': session });
                            res.clearCookie('session');
                            resolve();
                        }
                        db.collection('users').findOne({ 'email': ses.email }, function (err, ret) {
                            if (ret) { // User found
                                resolve(ret);
                            } else {
                                resolve();
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
            var v = req.body;
            var time = Date.now() / 1000;
            var lim = 25;
            var has_media = { $exists: true};
            var accepted = { $exists: true };
            var tags = { $exists: true };
            var _id = { $exists: true };
            var sort_by = 'score';
            if (v.timestamp != null && parseFloat(v.timestamp)) { //valid Unix time representation
                time = parseFloat(v.timestamp);
                console.log(time);
            } else if (v.timestamp != null && !parseFloat(v.timestamp)) { //invalid Unix time representation
                res.status(400);
                resolve({ status: "error", error: 'Invalid timestamp format' });
            }
            if (v.limit != null && parseInt(v.limit) >= 1 && parseInt(v.limit) <= 100) { //valid limit provided
                lim = parseInt(v.limit);
            } else if (v.limit != null) { //invalid limit
                res.status(400);
                resolve({ status: "error", error: 'Invalid limit provided' });
            }
            if (v.sort_by != null && v.sort_by == 'score' || v.sort_by == 'timestamp') { //valid limit provided
                sort_by = v.sort_by;
            } else if (v.sort_by != null) { //invalid sort operator
                res.status(400);
                resolve({ status: "error", error: 'Invalid sort_by input' });
            }
            if (v.tags) {
                tags = { $in: v.tags };
            }
            if (v.has_media) {
                has_media = {$nin: [null, []]};
            }
            if (v.accepted) {
                accepted = {$ne: null};
            }
            console.log("SEARCH PARAMS:: timestamp: " + time + "; limit: " + lim + ", phrase: " + v.q + ", tags: " + v.tags);
            if (v.q) { //search with phrase
                let eligibleDocs = new Set();
                let phrase = v.q.toLowerCase();
                let array = phrase.split(" ");
                for (let i = 0; i < array.length; i++) {
                    let docs = await findWordDocs(array[i]);
                    for (let j = 0; j < docs.length; j++) {
                        eligibleDocs.add(docs[j]);
                    }
                }
                eligibleDocs = Array.from(eligibleDocs);
                _id = {$in: eligibleDocs};
            }
            await db.collection('questions').find({ timestamp: { $lte: time }, _id: _id, tags: tags, media: has_media, accepted_answer_id: accepted }).sort({ sort_by: -1 }).limit(lim).toArray(async function (err, questions) {
                if (err) {
                    res.status(400);
                    resolve({ status: "error", error: err });
                } else {
                    if (questions.length > 0) {
                        let result = await prepareSearchResults(questions);
                        resolve(result);
                    } else {
                        console.log("no results");
                        resolve([]);
                    }
                }
            });
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
    checkExisting: async function (req, res) {
        return new Promise(async function (resolve, reject) {
            var qid = req.params.id;
            await db.collection('questions').findOne({'_id': qid}, function (err, ret1) {
                if (ret1) {
                    resolve(true);
                }
                else {
                    resolve(false);
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
                    resolve({ status: "error", error: "No such User" });
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
    deleteQuestion: async function (req, res) {
        return new Promise(async function (resolve, reject) {
            var user = undefined;
            var qid = req.params.id;
            await db.collection('questions').findOne({'_id': qid}, function(err, ret1){
                if ( ret1 == null){
                    res.status(404);
                    resolve({status:"error"});
                }
                else {
                    if (req.params.user == ret1.user) {
                        user = req.params.user;
                        var text = ret1.title + " " + ret1.body;
                        for (var i = 0; i < ret1.tags.length; i++) {
                            text += " " + ret1.tags[i];
                        }
                        text = text.toLowerCase().split(" ");
                        text = new Set(text);
                        text.forEach(function (word) {
                            db.collection('index').findOne({'word': word}, function (err, ret) {
                                if (ret) { //word has occurred before: update array
                                    let newDocuments = ret.documents;
                                    var index = newDocuments.indexOf(qid);
                                    if (index > -1) {
                                        newDocuments.splice(index, 1);
                                    }
                                    db.collection('index').updateOne({word: word}, {$set: {documents: newDocuments}});
                                }
                            });
                        });
                        var deletePromise = new Promise(async function (resolve, reject) {
                            await db.collection('questions').deleteOne({'_id': qid}, function (err, ret2) {
                                if (ret2.nRemoved == 0) {
                                    res.status(404)
                                    resolve({status: "error"});
                                }
                                else {
                                    resolve({status: "OK", ids: qid});
                                }
                            });
                        });
                        var deleteAnswersPromise = new Promise(async function (resolve, reject) {
                            var answer_ids = []
                            await db.collection('answers').find({'questionId': qid}, function(err, ret2){
                                ret2.forEach(function(row){
                                    answer_ids.push(row._id);
                                })
                            });
                            await db.collection('answers').remove({'questionId': qid});
                            resolve(answer_ids);
                        })
                        deletePromise.then(function (result) {
                            deleteAnswersPromise.then(function (result2) {
                                result.ids.concat(result2);
                                resolve(result);
                            })
                        });
                    }
                    else {
                        resolve({status: 401});
                    }
                }
            });
            if (user) {
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
    getScore: async function (req, res) {
        return new Promise(async function(resolve,reject){
            var id = req.params.id;
            var username = req.params.user;
            var upvote = req.params.upvote;
            var finalupvote = null;
            var database = req.params.database;
            if (!upvote){ upvote = true; }
            await db.collection(database).findOne({ '_id': id }, function (err, ret1) {
                if (!ret1){
                    res.status(404);
                    resolve({status: "error", error: "Item does not exist in " + database});
                }
                else{
                    var upvotePromise = new Promise(async function (resolve, reject){
                        await db.collection('score').findOne({'_id': id}, function(err, ret2){
                            if (!ret2){
                                console.log("Item not in score collection");
                                var upvotes = [];
                                var downvotes = []
                                if (upvote){ upvotes.push(username); }
                                else{ downvotes.push(username); }
                                var score = {
                                    _id: id,
                                    upvotes: upvotes,
                                    downvotes: downvotes
                                }
                                db.collection('score').insertOne(score, function(){
                                    resolve({score: upvotes.length - downvotes.length})
                                })
                            }
                            else{
                                console.log("Item in score collection");
                                console.log(ret2);
                                var upvotes = ret2.upvotes;
                                var downvotes = ret2.downvotes;
                                if (upvotes.includes(username)){
                                    upvotes = upvotes.filter( e => e !== username);
                                    finalupvote = false;
                                }
                                else if (downvotes.includes(username)) {
                                    downvotes = downvotes.filter( e => e !== username);
                                    finalupvote = true;
                                }
                                else{
                                    if (upvote){ upvotes.push(username); }
                                    else{ downvotes.push(username); }
                                }
                                db.collection('score').updateOne({'_id': id}, {$set : {upvotes: upvotes, downvotes: downvotes}});
                                resolve({score: upvotes.length - downvotes.length})
                            }
                        })
                    });
                    var reputationPromise = new Promise(async function(resolve, reject){
                        await db.collection('users').findOne({'username': ret1.user}, function(err, ret3) {
                            if (finalupvote == null) {
                                if (upvote) { ret3.reputation += 1; }
                                else { if (ret3.reputation > 1) { ret3.reputation -= 1; } }
                            }
                            else{
                                if (finalupvote) { ret3.reputation += 1; }
                                else { if (ret3.reputation > 1) { ret3.reputation -= 1; } }
                            }
                            db.collection('users').updateOne({ email: ret3.email }, { $set: { reputation: ret3.reputation } });
                            resolve();
                        })
                    })
                    upvotePromise.then(function(result){
                        db.collection('questions').updateOne({ _id: id }, { $set: { score: result.score }});
                        reputationPromise.then(function (result1){
                            resolve({status: "OK"});
                        })
                    })
                }
            });
        })
    },
    acceptAnswer: async function (req, res) {
        return new Promise(async function(resolve, reject){
            var answer_id = req.params.id;
            var currentUser = req.params.user;
            await db.collection('answers').findOne( {_id: answer_id}, function(err, ret){
                if (!ret){
                    res.status(404);
                    resolve({status: "error", error: "Answer does not exist."});
                }
                else{
                    var questionId = ret.questionId;
                    var answerer = ret.user;
                    var checkOPPromise = new Promise(async function (resolve, reject){
                       await db.collection('questions').findOne( {_id: questionId}, function(err, ret1){
                           if (!ret1){
                               res.status(404);
                               resolve({status: "error", error: "Question does not exist."});
                           }
                           else{
                               if (ret1.user != currentUser){
                                   res.status(401);
                                   resolve({status: "error", error: "Cannot accept an answer if you are not the original poster"});
                               }
                               else if (ret1.accepted_answer_id != null){
                                   res.status(401);
                                   resolve({status:"error", error: "You have already accepted an answer for this question"});
                               }
                               else{
                                   db.collection('questions').updateOne({ _id: questionId }, { $set: { accepted_answer_id: answer_id } });
                                   db.collection('answers').updateOne({ _id: answer_id}, {$set: {is_accepted: true}});
                                   resolve();
                               }
                           }
                       })
                    });
                    var getAnswererPromise = new Promise(async function (resolve, reject){
                        await db.collection('users').findOne({'username': answerer}, function (err, ret2){
                            db.collection('users').updateOne({ email: ret2.email}, {$inc : {reputation: 1}});
                            resolve({status:"OK"});
                        })
                    });
                    checkOPPromise.then(function(result) {
                        if (!result.status){
                            getAnswererPromise.then(function(result1){
                                resolve(result1);
                            })
                        }
                        else{ resolve(result); }
                    })
                }
            });
        })
    }
}