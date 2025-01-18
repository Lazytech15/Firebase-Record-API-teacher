// netlify/functions/export-to-sheets.js
const { google } = require('googleapis');
const sheets = google.sheets('v4');

// Replace with your target spreadsheet ID
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Parse the incoming data
        const { subject, section, sheetName, date, time, data } = JSON.parse(event.body);

        // Authenticate with Google
        const auth = await getGoogleAuth();
        
        // Get existing sheets to check if this one already exists
        const spreadsheet = await sheets.spreadsheets.get({
            auth,
            spreadsheetId: SPREADSHEET_ID
        });

        // Create a new sheet in the spreadsheet
        await sheets.spreadsheets.batchUpdate({
            auth,
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: {
                            title: sheetName
                        }
                    }
                }]
            }
        });

        // Format the data for Google Sheets
        const values = [
            [`ATTENDANCE RECORD - ${subject}`],
            [''],
            ['Subject:', subject],
            ['Section:', section],
            ['Date:', date],
            ['Time:', time],
            [''],
            ['STUDENT INFORMATION'],
            ['Student ID', 'Name', 'Course', 'Section', 'Time-in'],
            ...data.map(entry => [
                entry.studentId,
                entry.name,
                entry.course,
                entry.section,
                new Date(entry.timeIn).toLocaleString()
            ])
        ];

        // Update the sheet with data
        await sheets.spreadsheets.values.update({
            auth,
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            requestBody: { values }
        });

        // Apply formatting
        await sheets.spreadsheets.batchUpdate({
            auth,
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    // Merge title cells
                    {
                        mergeCells: {
                            range: {
                                sheetId: spreadsheet.data.sheets[spreadsheet.data.sheets.length - 1].properties.sheetId,
                                startRowIndex: 0,
                                endRowIndex: 1,
                                startColumnIndex: 0,
                                endColumnIndex: 5
                            },
                            mergeType: 'MERGE_ALL'
                        }
                    },
                    // Add borders
                    {
                        updateBorders: {
                            range: {
                                sheetId: spreadsheet.data.sheets[spreadsheet.data.sheets.length - 1].properties.sheetId,
                                startRowIndex: 8,
                                endRowIndex: 8 + data.length + 1,
                                startColumnIndex: 0,
                                endColumnIndex: 5
                            },
                            top: { style: 'SOLID', width: 1 },
                            bottom: { style: 'SOLID', width: 1 },
                            left: { style: 'SOLID', width: 1 },
                            right: { style: 'SOLID', width: 1 },
                            innerHorizontal: { style: 'SOLID', width: 1 },
                            innerVertical: { style: 'SOLID', width: 1 }
                        }
                    },
                    // Format header
                    {
                        repeatCell: {
                            range: {
                                sheetId: spreadsheet.data.sheets[spreadsheet.data.sheets.length - 1].properties.sheetId,
                                startRowIndex: 8,
                                endRowIndex: 9,
                                startColumnIndex: 0,
                                endColumnIndex: 5
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 0.8, green: 0.8, blue: 0.8 },
                                    textFormat: { bold: true },
                                    horizontalAlignment: 'CENTER'
                                }
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                        }
                    }
                ]
            }
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${spreadsheet.data.sheets[spreadsheet.data.sheets.length - 1].properties.sheetId}`
            })
        };

    } catch (error) {
        console.error('Error updating Google Sheet:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update Google Sheet' })
        };
    }
};

// Helper function to get Google Auth client
async function getGoogleAuth() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    return auth;
}