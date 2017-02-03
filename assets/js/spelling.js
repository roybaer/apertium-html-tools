/* @flow */


var unknownMarkRE = /([#*])([^.,;:\t\* ]+)/g;

/* Insert text into div, but wrapping a class .unknownWord around each
 * word that starts with '*', or .ungeneratedWord around those that
 * start with '#'; then run the spell checker on .unknownWord's. */
function insertWithSpelling(text, div) {
    div.html("");
    unknownMarkRE.lastIndex = 0;
    var match,
        last = 0;
    while((match = unknownMarkRE.exec(text))) {
        var preText = text.substring(last, match.index),
            unkClass = (match[1] === '*') ? 'unknownWord' : 'ungeneratedWord',
            unkText = match[2];
        div.append($(document.createElement('span')).text(preText));
        var unk = $(document.createElement('span')).text(unkText).addClass(unkClass);
        unk.data('index', match.index); // used by pickSpellingSuggestion
        div.append(unk);
        last = unknownMarkRE.lastIndex;
    }
    div.append($(document.createElement('span')).text(text.substring(last)));
    spell(div.find('.unknownWord'));
}

function spellFake(forms, language, onSuccess, onError) {
    // For testing when the network is down
    var result = $(forms).map(function(_i, f) {
        return {
            word: f,
            suggestions: [
                f.split("").reverse().join(""),
                f+"s",
                f.replace(/ie/g, "ei")
            ]
        };
    }).toArray();
    onSuccess(result);
}

function spellDivvun(forms, language, onSuccess, onError) {
    return $.jsonp({
        url: 'http://divvun.no:3000/spellcheck31/script/ssrv.cgi',
        data: {
            'cmd': 'check_spelling',
            'customerid': "1%3AWvF0D4-UtPqN1-43nkD4-NKvUm2-daQqk3-LmNiI-z7Ysb4-mwry24-T8YrS3-Q2tpq2",
            'run_mode': 'web_service',
            'format': 'json',
            'out_type': 'words',
            'version': '1.0',
            'slang': iso639Codes[language],
            'text': forms.join(",")
        },
        success: onSuccess,
        error: onError
    });
}

function getSpeller(language) {
    if(language === 'sme') {
        return spellDivvun;
        // return spellFake;
    }
    else {
        // TODO: apy-based spellers for apertium langs?
        return spellDivvun;
    }
};

var spellXHR = null;

function spell(unks) {
    var forms = unique(unks.map(function(_i, w) {
        return $(w).text();
    }));
    var language = curSrcLang;
    var speller = getSpeller(language);
    var success = function (data) {
        var suggmap = {};
        for(var i in data) {
            if(data[i].suggestions.length > 0) {
                suggmap[data[i].word] = data[i];
            }
        }
        unks.each(function(_i, w){
            var ww = $(w),
                form = ww.text(),
                d = suggmap[form];
            if(d === undefined || (!d.suggestions)) {
                return;
            }
            ww.data('spelling', d);
            ww.addClass('hasSuggestion');
            ww.on('click', clickSpellingSuggestion); // or on 'contextmenu'?
        });
    };
    if(forms.length > 0) {
        if(spellXHR != null) {
            // We only ever want to have the latest check results:
            spellXHR.abort();
        }
        spellXHR = speller(forms, language, success, console.log);
    }
    $("body").click(hideSpellingMenu);
}

function clickSpellingSuggestion(ev) {
    ev.preventDefault();
    var spelling = $(this).data('spelling');
    var spanoff = $(this).offset();
    var newoff = { top:  spanoff.top+20,
                   left: spanoff.left };
    var menu = $('#spellingMenu');
    var at_same_err = menu.offset().top == newoff.top && menu.offset().left == newoff.left;
    if(menu.is(":visible") && at_same_err) {
        hideSpellingMenu();
    }
    else {
        menu.show();
        menu.offset(newoff);
        if(!at_same_err) {
            makeSpellingMenu(this, spelling);
        }
    }
    return false;
}

var hideSpellingMenu = function()/*:void*/
{
  var menu = $('#spellingMenu');
  menu.offset({top:0, left:0}); // avoid some potential bugs with misplacement
  menu.hide();
};

function makeSpellingMenu(node, spelling) {
    $("#spellingTable").empty();
    var tbody = $('<tbody />');
    tbody.attr("role", "listbox");

    spelling.suggestions.map(function(sugg){
        var tr_rep =  $(document.createElement('tr')),
            td_rep =  $(document.createElement('td')),
            a_rep =  $(document.createElement('a'));
        a_rep.text(sugg);
        a_rep.attr("role", "option");
        td_rep.append(a_rep);
        td_rep.addClass("spellingSuggestion");
        // has to be on td since <a> doesn't fill the whole td
        td_rep.click({
            word: node,
            suggestion: sugg
        }, pickSpellingSuggestion);
        tr_rep.append(td_rep);
        tbody.append(tr_rep);
    });
    $("#spellingTable").append(tbody);
};

function pickSpellingSuggestion(args) {
    hideSpellingMenu();
    var origtxt = $('#originalText').val(),
        sugg = args.data.suggestion,
        outIndex = $(args.data.word).data('index'),
        inWord = $(args.data.word).text(),
        pos = -1,
        best = -1;
    while((pos = origtxt.indexOf(inWord, pos)) != -1) {
        best = pos;
        if(best > outIndex) {
            break;
        }
        ++pos;
    }
    if(best != -1) {
        var replaced = origtxt.substr(0, best) + sugg + origtxt.substr(best+inWord.length);
        $('#originalText').val(replaced);
        translateText();
    }
    else {
        console.log("Couldn't find inWord", inWord, " in #originalText", origtxt, "for suggestion", sugg, "near", outIndex);
    }
}

/*:: export {insertWithSpelling} */
/*:: import {unique} from util.js */