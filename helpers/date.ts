/** Today (or `date`) in Bangkok as YYYYMMDD, as in export file names like MDA_ACTIVITY_LOGS_20261118.csv */
export function bangkokYmd(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('-', '');
}

export function bangkokYear(date = new Date()) {
  return bangkokYmd(date).slice(0, 4);
}

/** DD/MM/YYYY in Bangkok, as the date range picker shows it ("20/11/2026 - 09/12/2026") */
export function bangkokDmy(date = new Date()) {
  const ymd = bangkokYmd(date);
  return `${ymd.slice(6)}/${ymd.slice(4, 6)}/${ymd.slice(0, 4)}`;
}
