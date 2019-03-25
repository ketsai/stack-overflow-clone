$(document).ready(function () {
    $("#submit").click(function() {
        $.ajax({
            data: { username: $("#username").val(), email: $("#email").val(), password: $("#password").val() },
            url: "/adduser",
            method: "POST",
            success: function (response) {
                if (response.msg) {
                    $("#msg").html(response.msg);
                } else {
                    $("#msg").html(response.error);
                }
            }
        });
    });
}); 