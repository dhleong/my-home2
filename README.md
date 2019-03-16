my-home2
========

*Making my home smarter*

## What?

This is the code that powers the "smart" aspects of my home, augmenting Google Home and Alexa. It's not intended to be run anywhere else, but I'm opening its quite ugly source to share some of the ideas.

## How?

The Google Home integration to start shows via the [http][4] and [player][5] modules is triggered using [IFTTT][1]'s Google Assistant integration connected to a Web Hook call. I've set up [dns-o-matic][2] to update a [free dynamic DNS service][3] so the webhook can talk to the `http` module.

[1]: https://ifttt.com/discover
[2]: https://dnsomatic.com/
[3]: https://freedns.afraid.org
[4]: modules/http.js
[5]: modules/player.js
