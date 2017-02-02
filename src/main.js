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
        width: 1100,
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
        console.log('Scraping complete');
        // we're done!
        phantom.exit();
    }
    console.log('About to scrape top level section ' + curChapter);
    clickTopLevelTOC(curChapter);
    waitUntilExists('iframe', function() {
        waitUntilExists('#chapterTitle, #chapterOutline', function() {
            // set styles
            page.evaluate(function() {
                var iframe = document.querySelector('iframe');
                var iDocument = iframe.contentDocument;
                var eDoc = iDocument.querySelector('#ebook_document');

                // remove everything outside of the iframe
                [].forEach.call(document.querySelectorAll('*:not(iframe)'), function(c) {
                    if(!c.contains(iframe)) {
                        c.style.display = 'none';
                    }
                });

                // remove unnecessary icons
                [].forEach.call(iDocument.querySelectorAll('a'), function(c) {
                    if(c.id == 'ebook_right' || c.id == 'ebook_left') {
                        c.style.visibility = 'hidden';
                        return;
                    }
                    if(!eDoc.contains(c)) {
                        c.style.display = 'none';
                    }
                });

                // remove skimmer
                iDocument.querySelector('#skimmer').style.display = 'none';

                // make the iframe big
                iframe.style.zIndex = 999999999;
                iframe.style.top = 0;
                iframe.style.left = 0;
                iframe.style.height = '100vh';
                iframe.style.width = '100vw';
                iframe.style.position = 'fixed';
                iframe.style.margin = 0;
                iframe.style.padding = 0;
                iframe.style.setProperty('border', 0, 'important');

                // make the inner document big
                eDoc.style.top = 0;
                eDoc.style.position = 'fixed';
                eDoc.style.height = '100vh';
                eDoc.style.width = '100vw';
            });
            // are we at chapter page?
            var curPage = -1;
            var openedLastTime = false;
            if (page.evaluate(function() {
                var toClick = document.querySelector('iframe').contentDocument.querySelector('#chapterTitle');
                if (toClick) {
                    toClick.click();
                }
                return !!toClick;
            })) {
                console.log('Accessing chapter contents...');
                waitUntilExists('#chapterTitle', nextStuff, true);
            } else {
                console.log('Already at chapter contents, about to scrape');
                nextStuff();
            }
            function nextStuff() {
                if (curPage === -1) {
                    ++curPage;
                    setTimeout(nextStuff, 3500);
                    return;
                }

                console.log('Scraping section ' + curChapter + ' page ' + curPage + '...');
                openedLastTime = page.evaluate(function(shouldOpenAnswers, openedLastTime) {
                    var iDocument = document.querySelector('iframe').contentDocument;
                    var eDoc = document.querySelector('#ebook_document');

                    // remove unnecessary icons
                    [].forEach.call(iDocument.querySelectorAll('a'), function(c) {
                        if(c.id == 'ebook_right' || c.id == 'ebook_left') {
                            c.style.visibility = 'hidden';
                            return;
                        }
                        if(!iDocument.querySelector('#ebook_document').contains(c)) {
                            //c.style.display = 'none';
                        }
                    });

                    // set font and open answers
                    var topElts = document.querySelectorAll('*');
                    for(var p = 0; p < topElts.length; ++p) {
                        topElts[p].style.fontFamily = 'Georgia';
                    }
                    // change font
                    var elts = iDocument.querySelectorAll('*');
                    for(var o = 0; o < elts.length; ++o) {
                        elts[o].style.fontFamily = 'Georgia';
                    }
                    // open answers
                    var answerElts = iDocument.querySelectorAll('.answer');
                    if (answerElts.length === 0 && openedLastTime) {
                        return false;
                    }
                    if (shouldOpenAnswers === 'true') {
                        if (openedLastTime) {
                            return false;
                        }
                        for(var t = 0; t < answerElts.length; ++t) {
                            answerElts[t].click();
                        }
                        return true;
                    }
                    return false;
                }, system.args[3], openedLastTime);
                var curHeight = page.evaluate(function(){
                    // get height
                    return document.querySelector('iframe').contentDocument.getElementById('ebook_document').getBoundingClientRect().height;
                });
                page.viewportSize = {
                    width: 1100,
                    height: curHeight + 230
                };
                // ignore very first page because it's glitchy
                page.render('pdfs/' + curChapter + '-' + curPage++ + '-chemistry.pdf');
                var isNext = page.evaluate(function() {
                    var nextBtn = document.querySelector('iframe').contentDocument.querySelector('a[title="Next Page"]');
                    var shouldClick = nextBtn.style.display !== 'none';
                    if (shouldClick) {
                        nextBtn.click();
                    }
                    return shouldClick;
                });
                if (isNext) {
                    setTimeout(nextStuff, 2000);
                } else {
                    console.log('Current top-level section complete');
                    ++curChapter;
                    openedLastTime = false;
                    TOCRecursionTop();
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
