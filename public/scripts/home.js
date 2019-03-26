if ($("#msg").text() == "Welcome! Please register or log in.") {
    $("#register").show();
    $("#login").show();
    $("#logout").hide();
} else {
    $("#logout").show();
    $("#register").hide();
    $("#login").hide();
}
for (let i = 0; i < 10; i++) {
    $("#q" + (i + 1).toString()).hide();
}
$.ajax({
    url: "/recentQuestions",
    method: "POST",
    success: function (response) {
        if (response.questions != null) {
            for (var i = 0; i < response.questions.length && i < 10; i++) {
                $("#q" + (i + 1).toString()).show();
                $("#q" + (i + 1).toString() + "a").html(response.questions[i].title);
                $("#q" + (i + 1).toString() + "b").html(response.questions[i].user);
                $("#q" + (i + 1).toString() + "c").html(response.questions[i].timestamp);
                $("#q" + (i + 1).toString() + "d").html(response.questions[i]._id);
                $("#q" + (i + 1).toString() + "e").html(response.questions[i].viewers.length);
            }
        }
    }
});