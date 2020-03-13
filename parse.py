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
  'PlaceStatus', ('locality', 'region', 'country', 'confirmed', 'deaths', 'recovered', 'lat', 'lon')
)
ScriptDir = pathlib.Path(__file__).resolve().parent
DailiesDir = ScriptDir/'csse_covid_19_data/csse_covid_19_daily_reports'
DESCRIPTION = """Get the daily totals for any region."""


def make_argparser():
  parser = argparse.ArgumentParser(add_help=False, description=DESCRIPTION)
  options = parser.add_argument_group('Options')
  options.add_argument('country', metavar='Country', nargs='?', type=lambda c: Translations.get(c,c),
    help='Nation')
  options.add_argument('-r', '--region', metavar='Region', type=lambda r: Translations.get(r,r),
    help='State, Province, etc.')
  options.add_argument('-v', '--invert', action='store_true',
    help='Select all locations *not* matching the specified one.')
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

  count = 0
  for timestamp, total in get_series(DailiesDir, args.region, args.country, args.invert):
    print(timestamp, total, sep='\t')
    count += 1

  if count == 0:
    logging.warning('No reports found for the specified location.')


def get_series(dailies_dir, region, country, invert):
  for csv_path in sorted(dailies_dir.iterdir(), key=lambda path: path.name):
    if csv_path.suffix != '.csv':
      continue
    date = datetime.datetime.strptime(csv_path.stem, '%m-%d-%Y')
    total = 0
    for row in parse_csv(csv_path):
      matches = False
      if region and row.region == region:
        matches = True
      if country and row.country == country:
        matches = True
      if region is None and country is None:
        matches = True
      if (matches and not invert) or (not matches and invert):
        total += row.confirmed
    if total:
      yield int(date.timestamp()), total


def parse_csv(csv_path):
  with csv_path.open('rt') as csv_file:
    for row_num, row in enumerate(csv.reader(csv_file), 1):
      locality, region = parse_region(row[0])
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
      yield PlaceStatus(locality, region, country, confirmed, deaths, recovered, lat, lon)


def parse_region(raw_region):
  fields = raw_region.split(', ')
  if len(fields) == 1:
    locality = None
    if raw_region:
      region = raw_region
    else:
      region = None
  elif len(fields) == 2:
    locality = fields[0]
    region = RegionCodes.get(fields[1], fields[1])
  else:
    raise ValueError(f'Invalid region field {raw_region!r}')
  return locality, Translations.get(region, region)


def parse_int(raw_int):
  if raw_int == '':
    return 0
  else:
    return int(raw_int)


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

RegionCodes = {
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'DC': 'District of Columbia',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming',
  'AS': 'American Samoa',
  'GU': 'Guam',
  'MP': 'Northern Mariana Islands',
  'PR': 'Puerto Rico',
  'VI': 'U.S. Virgin Islands',
}


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
