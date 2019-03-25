$(document).ready(function () {
    $("#submit").click(function() {
        $.ajax({
            data: { username: $("#username").val(), email: $("#email").val(), password: $("#password").val() },
            url: "/adduser",
            method: "POST",
            success: function (response) {
                $("#msg").html(response.msg);
            }
        });
    });
}); 