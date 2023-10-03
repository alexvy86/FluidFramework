mkdir -p /tmp/testRuns

STATUS=0
COUNTER=0
while [ $STATUS -eq 0 ]
do
	# Clean up log files so we don't keep increasing the used space. Ignore if it fails (if there are no files).
	rm /tmp/testRuns/* > /dev/null

	COUNTER=$((COUNTER+1))
	export TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
	OUTPUT_FILE=$TIMESTAMP.log
	echo "Running tests ($COUNTER)...output file: /tmp/testRuns/$OUTPUT_FILE"
	npm run test:realsvc:tinylicious > /tmp/testRuns/$OUTPUT_FILE 2>&1
	STATUS=$?
done

# Copy the files back because /tmp gets regenerated when the container starts
cp /tmp/testRuns/${TIMESTAMP}* .

echo "Tests failed with status $STATUS"
