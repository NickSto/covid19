#!/usr/bin/env python3
import argparse
import logging
import pathlib
import subprocess
import sys
assert sys.version_info.major >= 3, 'Python 3 required'

ScriptDir = pathlib.Path(__file__).resolve().parent
DESCRIPTION = """Plot cases over time."""


def make_argparser():
  parser = argparse.ArgumentParser(add_help=False, description=DESCRIPTION)
  options = parser.add_argument_group('Options')
  options.add_argument('country', metavar='Country', nargs='?',
    help='Nation')
  options.add_argument('-r', '--region', metavar='Region',
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

  if args.region and args.country:
    title = f'{args.region}, {args.country}'
  elif args.country:
    title = args.country
  elif args.region:
    title = args.region
  else:
    title = 'World'
  title += ' COVID-19 Cases'

  parse_cmd = [ScriptDir/'parse.py']
  if args.country:
    parse_cmd.append(args.country)
  if args.region:
    parse_cmd.extend(['--region', args.region])
  parse_proc = subprocess.Popen(parse_cmd, stdout=subprocess.PIPE, encoding='utf8')
  plot_cmd = (
    'scatterplot.py', '--unix-time', 'x', '--date', '--y-label', 'Total Cases', '--title', title
  )
  plot_proc = subprocess.Popen(plot_cmd, stdin=parse_proc.stdout, encoding='utf8')
  parse_proc.stdout.close()


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
