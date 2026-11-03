#!/bin/bash
# The whole Aurora suite, one test after another. Run from marketing/tools.
mkdir -p aurora-tests/work/suite
for t in r5 steps fix endless round2 r4 islands newisland growth map4 hunch2 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r18; do
  timeout 300 node --input-type=module < "aurora-tests/test-$t.mjs" > "aurora-tests/work/suite/$t.txt" 2>&1
  code=$?
  if grep -q "TimeoutError\|Error:\|triggerUncaughtException" "aurora-tests/work/suite/$t.txt"; then echo "$t: FAILED (exit $code)"; else echo "$t: ran (exit $code)"; fi
done
