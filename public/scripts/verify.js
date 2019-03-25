$(document).ready(function () {
    $("#submit").click(function() {
        $.ajax({
            data: { email: $("#email").val(), key: $("#key").val() },
            url: "/verify",
            method: "POST",
            success: function (response) {
                $("#msg").html(response.msg);
            }
        });
    });
}); 