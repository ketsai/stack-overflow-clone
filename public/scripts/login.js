$(document).ready(function () {
    $("#submit").click(function() {
        $.ajax({
            data: { username: $("#username").val(), password: $("#password").val() },
            url: "/login",
            method: "POST",
            success: function (response) {
                if (response.msg != null) {
                    $("#msg").html(response.msg);
                }
            },
            error: function (response) {
                if (response.error != null) {
                    $("#msg").html(response.error);
                }
            }
        });
    });
}); 