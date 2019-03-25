if ($("#msg").text() == "Welcome! Please register or log in.") {
    $("#register").show();
    $("#login").show();
    $("#play").hide();
    $("#logout").hide();
} else {
    $("#play").show();
    $("#logout").show();
    $("#register").hide();
    $("#login").hide();
}