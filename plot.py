#!/usr/bin/env python3
import argparse
import logging
import pathlib
import subprocess
import sys
import time
import parse
assert sys.version_info.major >= 3, 'Python 3 required'

DESCRIPTION = """Plot cases over time."""


def make_argparser():
  parser = argparse.ArgumentParser(add_help=False, description=DESCRIPTION)
  options = parser.add_argument_group('Options')
  options.add_argument('country', metavar='Country', nargs='?',
    type=lambda c: parse.Translations.get(c,c),
    help='Nation')
  options.add_argument('-r', '--region', metavar='Region',
    type=lambda r: parse.Translations.get(r,r),
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
  volume.add_argument('-V', '--verbose', dest='volume', action='store_const', const=logging.INFO)
  volume.add_argument('-D', '--debug', dest='volume', action='store_const', const=logging.DEBUG)
  return parser


def main(argv):

  parser = make_argparser()
  args = parser.parse_args(argv[1:])

  logging.basicConfig(stream=args.log, level=args.volume, format='%(message)s')

  if args.region and args.country:
    location = f'{args.region}, {args.country}'
  elif args.country:
    location = args.country
  elif args.region:
    location = args.region
  else:
    location = 'World'
  if args.invert:
    title = 'COVID-19 cases outside of '+location
  else:
    title = location+' COVID-19 cases'

  now = int(time.time())
  cmd = (
    'scatterplot.py', '--unix-time', 'x', '--date', '--x-range', '1579669200', str(now),
    '--y-label', 'Total Cases', '--title', title
  )
  process = subprocess.Popen(cmd, stdin=subprocess.PIPE, encoding='utf8')

  count = 0
  for timestamp, total in parse.get_series(parse.DailiesDir, args.region, args.country, args.invert):
    process.stdin.write(f'{timestamp}\t{total}\n')
    count += 1

  if count == 0:
    logging.warning('No reports found for the specified location.')


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
