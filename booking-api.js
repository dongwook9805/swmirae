'use strict';

const bookingEndpoint = 'https://script.google.com/macros/s/AKfycbzN4tIbtq399pnhcIcv7U1GLIISXdXjQHG9NZT3nJ-pvnwDTLKX1Dt4OgXzPpkecaA5/exec';

function requestBooking(payload) {
  return fetch(bookingEndpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
