#!/usr/bin/env python3
import argparse
import collections
import csv
import datetime
import logging
import pathlib
import sys
assert sys.version_info.major >= 3, 'Python 3 required'

PlaceStatus = collections.namedtuple(
  'PlaceStatus', ('region', 'country', 'confirmed', 'deaths', 'recovered', 'lat', 'lon')
)
ScriptDir = pathlib.Path(__file__).resolve().parent
DailiesDir = ScriptDir/'csse_covid_19_data/csse_covid_19_daily_reports'
Translations = {
  'District of Columbia': 'DC',
  'Mainland China': 'China',
  'Iran (Islamic Republic of)': 'Iran',
  'Republic of Korea': 'South Korea',
  'Korea, South': 'South Korea',
  'Britain': 'UK',
  'United Kingdom': 'UK',
  'United States': 'US',
  'Hong Kong SAR': 'Hong Kong',
  'Taipei and environs': 'Taiwan',
  'Taiwan*': 'Taiwan',
  'occupied Palestinian territory': 'Palestine',
  'Russian Federation': 'Russia',
}
DESCRIPTION = """Get the daily totals for any region."""


def make_argparser():
  parser = argparse.ArgumentParser(add_help=False, description=DESCRIPTION)
  options = parser.add_argument_group('Options')
  options.add_argument('country', metavar='Country', nargs='?', type=lambda c: Translations.get(c,c),
    help='Nation')
  options.add_argument('-r', '--region', metavar='Region', type=lambda r: Translations.get(r,r),
    help='State, Province, etc.')
  options.add_argument('-h', '--help', action='help',
    help='Print this argument help text and exit.')
  logs = parser.add_argument_group('Logging')
  logs.add_argument('-l', '--log', type=argparse.FileType('w'), default=sys.stderr,
    help='Print log messages to this file instead of to stderr. Warning: Will overwrite the file.')
  volume = logs.add_mutually_exclusive_group()
  volume.add_argument('-q', '--quiet', dest='volume', action='store_const', const=logging.CRITICAL,
    default=logging.WARNING)
  volume.add_argument('-v', '--verbose', dest='volume', action='store_const', const=logging.INFO)
  volume.add_argument('-D', '--debug', dest='volume', action='store_const', const=logging.DEBUG)
  return parser


def main(argv):

  parser = make_argparser()
  args = parser.parse_args(argv[1:])

  logging.basicConfig(stream=args.log, level=args.volume, format='%(message)s')

  for timestamp, total in get_series(DailiesDir, args.region, args.country):
    print(timestamp, total, sep='\t')


def get_series(dailies_dir, region, country):
  for csv_path in sorted(dailies_dir.iterdir(), key=lambda path: path.name):
    if csv_path.suffix != '.csv':
      continue
    date = datetime.datetime.strptime(csv_path.stem, '%m-%d-%Y')
    total = 0
    for row in parse_csv(csv_path):
      if country and row.country != country:
        continue
      if region and row.region != region:
        continue
      total += row.confirmed
    if total:
      yield int(date.timestamp()), total


def parse_csv(csv_path):
  with csv_path.open('rt') as csv_file:
    for row_num, row in enumerate(csv.reader(csv_file), 1):
      if row[0]:
        region = Translations.get(row[0], row[0])
      else:
        region = None
      country = Translations.get(row[1], row[1])
      try:
        confirmed = parse_int(row[3])
        deaths = parse_int(row[4])
        recovered = parse_int(row[5])
      except ValueError:
        if row_num == 1:
          continue
        else:
          raise
      if len(row) == 6:
        lat = lon = None
      elif len(row) == 8:
        lat = float(row[6])
        lon = float(row[7])
      else:
        raise ValueError(f'Too few columns in {csv_path.name} on line {row_num}.')
      yield PlaceStatus(region, country, confirmed, deaths, recovered, lat, lon)


def parse_int(raw_int):
  if raw_int == '':
    return 0
  else:
    return int(raw_int)


def fail(message):
  logging.critical('Error: '+str(message))
  if __name__ == '__main__':
    sys.exit(1)
  else:
    raise Exception(message)


if __name__ == '__main__':
  try:
    sys.exit(main(sys.argv))
  except BrokenPipeError:
    pass
