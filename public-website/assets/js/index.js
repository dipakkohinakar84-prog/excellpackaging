$(document).ready(function () {
    $('[data-toggle="scroll"]').on('click', function (e) {
        e.preventDefault();

        var target = $($(this).data('target'));
        if (target.length) {
            $('body, html').stop().animate({
                scrollTop: target.offset().top
            }, 1000);
        }
    });
});
