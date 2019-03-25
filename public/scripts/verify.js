$(document).ready(function () {
    $("#submit").click(function() {
        $.ajax({
            data: { email: $("#email").val(), key: $("#key").val() },
            url: "/verify",
            method: "POST",
            success: function (response) {
                if (response.msg != null) {
                    $("#msg").html(response.msg);
                } else if (response.error != null) {
                    $("#msg").html(response.error);
                }
            }
        });
    });
}); 