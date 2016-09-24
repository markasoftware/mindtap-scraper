'use strict';

var system = require('system');
var email = system.args[1];
var pass = system.args[2];
var page;
console.log('Using the following credentials:');
console.log('Email: ' + email);
console.log('Password: ' + pass);
console.log('If either of these are incorrect, hit ctrl-c now');

function checkFail(status) {
    if(status !== 'success') {
        console.error('There was an error loading a loginPage');
        phantom.exit(1);
    }
}

var loginPage = require('webpage').create();
loginPage.viewportSize = {
    width: 1920,
    height: 1080
};
console.log('Accessing Login Page...');
loginPage.open('https://login.cengagebrain.com/cb/login.htm', function(status) {
    checkFail(status);
    console.log('Logging in...');
    loginPage.onLoadFinished = mindTapSelector;
    loginPage.evaluate(function(email, pass) {
        document.getElementById('email').value = email;
        document.getElementById('fmPassword').value = pass;
        login();
    }, email, pass);
});

function mindTapSelector(status) {
    loginPage.onLoadFinished = null;
    checkFail(status);
    console.log('Accessing table of contents...');
    loginPage.onPageCreated = TOCController;
    loginPage.evaluate(function() {
        // find the right button to click, and click it
        var possibleLabels = document.querySelectorAll('li.dashboard_label');
        for(var k = 0; k < possibleLabels.length; ++k) {
            if(possibleLabels[k].firstElementChild.textContent.toLowerCase().indexOf('mindtap') !== -1) {
                possibleLabels[k].nextElementSibling.querySelector('a.viewDetailsBtn').click();
                return;
            }
        }
    });
}

function waitUntilExists(selector, cb) {
    var isInFrame = !!arguments[2];
    function isLoaded() {
        var numElts = page.evaluate(function(selector, isInFrame) {
            if (isInFrame) {
                return document.querySelector('iframe').contentDocument.querySelectorAll(selector).length;
            } else {
                return document.querySelectorAll(selector).length;
            }
        }, selector, isInFrame);
        if(numElts > 0) {
            cb();
        } else {
            setTimeout(isLoaded, 100);
        }
    }
    isLoaded();
}

function TOCController (argPage) {
    page = argPage;
    page.viewportSize = {
        width: 1200,
        height: 6000
    };
    page.onLoadFinished = function(status) {
        page.onLoadFinished = null;
        checkFail(status);
        // apparently it loads stuff after this (ajax?) so we have to do this shit
        console.log('Waiting for TOC to finish loading...');
        waitUntilExists('.lpn_name > a', function() {
            TOCRecursionTop();
        });
    };
}

var curChapter = 0;
function TOCRecursionTop () {
    if (curChapter === 27) {
        // we're done!
        phantom.exit(0);
    }
    console.log('About to scrape top level section ' + curChapter);
    clickTopLevelTOC(curChapter);
    waitUntilExists('iframe', function() {
        console.log('iframe exists');
        // set styles
        page.evaluate(function() {
            var b = document.querySelector('iframe');
            b.style.height = '100vh';
            b.style.width = '100vw';
            b.style.position = 'fixed';
            b.style.top = '0';
            b.style.zIndex = '100000';
            var topBar = document.getElementById('nb_toolbar');
            topBar.style.display = 'none';
        });
        waitUntilExists('#chapterTitle, #chapterOutline', function() {
            // are we at chapter page?
            var curPage = -1;
            if (page.evaluate(function() {
                var toClick = document.querySelector('iframe').contentDocument.querySelector('#chapterTitle');
                if (toClick) {
                    toClick.click();
                }
                return !!toClick;
            })) {
                waitUntilExists('#chapterTitle', nextStuff, true);
            } else { nextStuff(); }
            function nextStuff() {
                if (curPage === -1) {
                    ++curPage;
                    setTimeout(nextStuff, 3500);
                }
                page.evaluate(function() {
                    var elts = document.querySelector('iframe').contentDocument.querySelectorAll('*');
                    for(var o = 0; o < elts.length; ++o) {
                        elts[o].style.fontFamily = '"Source Sans Pro"';
                    }
                });
                page.render(curChapter + ' - ' + curPage++ + ' - chemistry.pdf');
                var isNext = page.evaluate(function() {
                    var nextBtn = document.querySelector('iframe').contentDocument.querySelector('a[title="Next Page"]');
                    if (nextBtn) {
                        nextBtn.click();
                    }
                    return !!nextBtn;
                });
                if (isNext) {
                    setTimeout(nextStuff, 3500);
                } else {
                    ++curChapter;
                    phantom.exit();
                    //TOCRecursionTop();
                }
            }
        }, true);
    });
}

function TOCRecursionIntra (cb) {

}

function clickTopLevelTOC (whichToClick) {
    page.evaluate(function(whichToClick) {
        var toClickArr = document.querySelectorAll('.lpn_name > a');
        toClickArr[whichToClick+2].click();
    }, whichToClick);
}
