#!/usr/bin/python3
import json, os, sys
with open(os.environ['TASKOTTER_WSLC_LOG'], 'a') as f:
    f.write(json.dumps({'args': sys.argv[1:], 'cwd': os.getcwd()}, ensure_ascii=False) + '\n')
sys.exit(int(os.environ.get('TASKOTTER_WSLC_FAILURE', '0')))
