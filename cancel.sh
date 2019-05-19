#!/bin/bash

curl http://localhost:6666/slack/timer_message/cancel/${1} -X POST \
    -H 'Content-Type: application/json'
