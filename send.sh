#!/bin/bash

curl http://localhost:6666/slack/timer_message/register -X POST \
    -H 'Content-Type: application/json' \
    -d @${1}
